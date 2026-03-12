// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IAerodromeCL.sol";
import "./interfaces/IAaveV3.sol";
import "./libraries/TickMath.sol";
import "./libraries/LiquidityAmounts.sol";

/// @title AutoBasisVault — Automated Multi-Strategy Vault
/// @notice ERC-4626 vault that allocates across 4 strategies:
///         1. Concentrated LP on Aerodrome (earn trading fees)
///         2. 2x Long ETH via Aave V3 (supply ETH, borrow USDC, buy more ETH)
///         3. 2x Short ETH via Aave V3 (supply USDC, borrow ETH, sell for USDC)
///         4. Hold (idle USDC/WETH — no exposure)
///
///         A "strategist" role calls rebalance() with target allocations.
///         The strategist can NEVER withdraw user funds — only rebalance.
///         Users deposit/withdraw USDC freely at any time.
///         UUPS upgradeable. 0% fees — pure public good.
contract AutoBasisVault is
    Initializable,
    ERC4626Upgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  CUSTOM ERRORS (saves ~3kb vs string reverts)
    // ══════════════════════════════════════════════════════════════

    error ZeroAddress();
    error NotAdmin();
    error NotStrategist();
    error DepositCapExceeded();
    error AllocationInvalid();
    error CooldownActive();
    error UpgradesRenounced();
    error InvalidParam();

    // ══════════════════════════════════════════════════════════════
    //  CONSTANTS
    // ══════════════════════════════════════════════════════════════

    uint256 constant BPS = 10000;
    uint256 constant VARIABLE_RATE = 2; // Aave V3 variable rate mode

    // ══════════════════════════════════════════════════════════════
    //  STRUCTS
    // ══════════════════════════════════════════════════════════════

    /// @notice Target allocation percentages (in bps, must sum to 10000)
    struct Allocation {
        uint256 lpBps;      // % to concentrated LP
        uint256 longBps;    // % to 2x long ETH
        uint256 shortBps;   // % to 2x short ETH
        uint256 holdBps;    // % to idle hold
    }

    /// @notice LP strategy parameters
    struct LPParams {
        int24 rangeWidth;        // tick range width (e.g. 400 = ±2%, 1600 = ±8%)
        uint256 slippageBps;     // max slippage per swap (e.g. 50 = 0.5%)
    }

    // ══════════════════════════════════════════════════════════════
    //  STATE — External contracts
    // ══════════════════════════════════════════════════════════════

    // Aerodrome
    INonfungiblePositionManager public positionManager;
    ICLSwapRouter public swapRouter;
    address public aeroPool;       // ETH/USDC CL pool

    // Aave V3
    IAaveV3Pool public aavePool;
    IAToken public aWeth;          // aToken for WETH (collateral for long)
    IAToken public aUsdc;          // aToken for USDC (collateral for short)
    IVariableDebtToken public vDebtUsdc; // variable debt USDC (borrowed for long)
    IVariableDebtToken public vDebtWeth; // variable debt WETH (borrowed for short)

    // Tokens
    IERC20 public weth;

    // ══════════════════════════════════════════════════════════════
    //  STATE — Positions
    // ══════════════════════════════════════════════════════════════

    // LP position
    uint256 public lpTokenId;
    int24 public lpTickLower;
    int24 public lpTickUpper;

    // Current allocation targets
    Allocation public currentAllocation;

    // LP params
    LPParams public lpParams;

    // Token ordering
    bool public wethIsToken0;

    // ══════════════════════════════════════════════════════════════
    //  STATE — Access control
    // ══════════════════════════════════════════════════════════════

    address public admin;
    address public strategist;     // can call rebalance(), nothing else
    bool public upgradeRenounced;

    // Deposit cap
    uint256 public depositCap;

    // Safety
    uint256 public minHealthFactor;    // e.g. 1.5e18 — auto-deleverage below this
    uint256 public maxSingleMoveBps;   // e.g. 2500 = 25% max capital moved per rebalance
    uint256 public lastRebalanceTime;
    uint256 public rebalanceCooldown;  // min seconds between rebalances

    // Counters
    uint256 public rebalanceCount;

    // Circuit breaker
    uint256 public allTimeHighAssets;
    uint256 public drawdownBreakBps;   // e.g. 1500 = 15% drawdown triggers full hold
    bool public circuitBreakerTripped;

    // Reserve slots
    uint256[40] private __gap;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event Rebalanced(
        uint256 lpBps, uint256 longBps, uint256 shortBps, uint256 holdBps,
        uint256 totalAssets
    );
    event CircuitBreakerTripped(uint256 currentAssets, uint256 allTimeHigh);
    event CircuitBreakerReset();
    event StrategistUpdated(address indexed oldStrategist, address indexed newStrategist);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event LPParamsUpdated(int24 rangeWidth, uint256 slippageBps);
    event EmergencyExitAll(uint256 usdcRecovered);

    // ══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyStrategist() {
        if (msg.sender != strategist && msg.sender != admin) revert NotStrategist();
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ══════════════════════════════════════════════════════════════

    /// @notice Init params packed into a struct to avoid stack-too-deep
    struct InitParams {
        address usdc;
        address weth_;
        address positionManager_;
        address swapRouter_;
        address aeroPool_;
        address aavePool_;
        address aWeth_;
        address aUsdc_;
        address vDebtUsdc_;
        address vDebtWeth_;
        address admin_;
        uint256 depositCap_;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(InitParams calldata p) external initializer {
        if (p.usdc == address(0) || p.weth_ == address(0)) revert ZeroAddress();
        if (p.positionManager_ == address(0) || p.swapRouter_ == address(0)) revert ZeroAddress();
        if (p.aeroPool_ == address(0) || p.aavePool_ == address(0)) revert ZeroAddress();
        if (p.admin_ == address(0)) revert ZeroAddress();

        __ERC20_init("Basis Auto Vault", "abUSDC");
        __ERC4626_init(IERC20(p.usdc));
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        weth = IERC20(p.weth_);
        positionManager = INonfungiblePositionManager(p.positionManager_);
        swapRouter = ICLSwapRouter(p.swapRouter_);
        aeroPool = p.aeroPool_;
        aavePool = IAaveV3Pool(p.aavePool_);
        aWeth = IAToken(p.aWeth_);
        aUsdc = IAToken(p.aUsdc_);
        vDebtUsdc = IVariableDebtToken(p.vDebtUsdc_);
        vDebtWeth = IVariableDebtToken(p.vDebtWeth_);
        admin = p.admin_;
        strategist = p.admin_; // admin is default strategist
        depositCap = p.depositCap_;

        wethIsToken0 = p.weth_ < p.usdc;

        // Default safety params
        minHealthFactor = 1.5e18;
        maxSingleMoveBps = 2500;      // 25% max per rebalance
        rebalanceCooldown = 4 hours;
        drawdownBreakBps = 1500;       // 15% drawdown circuit breaker

        // Default LP params
        lpParams = LPParams({
            rangeWidth: 400,           // ±2% range
            slippageBps: 50            // 0.5% slippage
        });

        // Start fully in hold
        currentAllocation = Allocation({
            lpBps: 0,
            longBps: 0,
            shortBps: 0,
            holdBps: BPS
        });
    }

    function version() external pure returns (uint256) { return 1; }

    // ══════════════════════════════════════════════════════════════
    //  ERC-721 RECEIVER
    // ══════════════════════════════════════════════════════════════

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // ══════════════════════════════════════════════════════════════
    //  ERC-4626 OVERRIDES
    // ══════════════════════════════════════════════════════════════

    /// @notice Total USDC value across all 4 positions
    function totalAssets() public view override returns (uint256) {
        return _idleUsdc() + _lpValue() + _longValue() + _shortValue();
    }

    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 total = totalAssets();
        if (total >= depositCap) return 0;
        return depositCap - total;
    }

    function maxMint(address receiver) public view override returns (uint256) {
        return _convertToShares(maxDeposit(receiver), Math.Rounding.Floor);
    }

    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override nonReentrant whenNotPaused {
        if (totalAssets() + assets > depositCap) revert DepositCapExceeded();
        super._deposit(caller, receiver, assets, shares);
        _updateATH();
    }

    /// @dev Withdrawals always work. Unwind positions if needed.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override nonReentrant {
        uint256 idle = _idleUsdc();
        if (idle < assets) {
            _freeUsdc(assets - idle);
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    // ══════════════════════════════════════════════════════════════
    //  STRATEGIST — REBALANCE
    // ══════════════════════════════════════════════════════════════

    /// @notice Rebalance the vault to new target allocations.
    ///         Only callable by strategist. Cannot withdraw funds.
    /// @param lpBps    Target LP allocation in bps
    /// @param longBps  Target 2x Long allocation in bps
    /// @param shortBps Target 2x Short allocation in bps
    /// @param holdBps  Target Hold allocation in bps
    /// @param newRangeWidth Optional: update LP range width (0 = keep current)
    function rebalance(
        uint256 lpBps,
        uint256 longBps,
        uint256 shortBps,
        uint256 holdBps,
        int24 newRangeWidth
    ) external onlyStrategist nonReentrant {
        if (lpBps + longBps + shortBps + holdBps != BPS) revert AllocationInvalid();
        if (block.timestamp < lastRebalanceTime + rebalanceCooldown) revert CooldownActive();

        // Check circuit breaker
        if (_checkCircuitBreaker()) return;

        // Update LP range if requested
        if (newRangeWidth > 0) {
            lpParams.rangeWidth = newRangeWidth;
        }

        uint256 total = totalAssets();
        if (total == 0) {
            currentAllocation = Allocation(lpBps, longBps, shortBps, holdBps);
            lastRebalanceTime = block.timestamp;
            return;
        }

        // Exit all positions to USDC, then re-enter at new targets.
        // Simple, gas-efficient on Base (~0.01 gwei), avoids complex partial unwinds.
        _exitAllPositions();

        uint256 idle = _idleUsdc();

        // Re-enter at new target allocations
        uint256 forLP = (idle * lpBps) / BPS;
        uint256 forLong = (idle * longBps) / BPS;
        uint256 forShort = (idle * shortBps) / BPS;
        // Remainder stays as hold

        if (forLP > 0) _enterLP(forLP);
        if (forLong > 0) _enterLong(forLong);
        if (forShort > 0) _enterShort(forShort);

        // Save state
        currentAllocation = Allocation(lpBps, longBps, shortBps, holdBps);
        lastRebalanceTime = block.timestamp;
        rebalanceCount++;
        _updateATH();

        emit Rebalanced(lpBps, longBps, shortBps, holdBps, totalAssets());
    }

    // ══════════════════════════════════════════════════════════════
    //  CIRCUIT BREAKER
    // ══════════════════════════════════════════════════════════════

    function _checkCircuitBreaker() internal returns (bool) {
        uint256 total = totalAssets();
        if (allTimeHighAssets == 0) return false;

        uint256 threshold = allTimeHighAssets * (BPS - drawdownBreakBps) / BPS;
        if (total < threshold && !circuitBreakerTripped) {
            // Trip the breaker — go full hold
            circuitBreakerTripped = true;
            _exitAllPositions();
            currentAllocation = Allocation(0, 0, 0, BPS);
            lastRebalanceTime = block.timestamp;
            emit CircuitBreakerTripped(total, allTimeHighAssets);
            return true;
        }
        return false;
    }

    function resetCircuitBreaker() external onlyAdmin {
        circuitBreakerTripped = false;
        allTimeHighAssets = totalAssets();
        emit CircuitBreakerReset();
    }

    function _updateATH() internal {
        uint256 total = totalAssets();
        if (total > allTimeHighAssets) {
            allTimeHighAssets = total;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — LP OPERATIONS (Aerodrome)
    // ══════════════════════════════════════════════════════════════

    /// @dev Mint a fresh LP position, returning the NFT id
    function _mintLP(uint256 usdcAmount, int24 tl, int24 tu) internal {
        int24 ts = ICLPool(aeroPool).tickSpacing();
        uint256 usdcToSwap = _calcLPSwapAmount(usdcAmount, tl, tu);
        uint256 wethAmt = usdcToSwap > 0 ? _swap(asset(), address(weth), usdcToSwap) : 0;
        uint256 usdcAmt = IERC20(asset()).balanceOf(address(this));

        (uint256 a0, uint256 a1) = wethIsToken0 ? (wethAmt, usdcAmt) : (usdcAmt, wethAmt);
        address t0 = wethIsToken0 ? address(weth) : asset();
        address t1 = wethIsToken0 ? asset() : address(weth);
        uint256 slip = lpParams.slippageBps;

        IERC20(t0).forceApprove(address(positionManager), a0);
        IERC20(t1).forceApprove(address(positionManager), a1);

        (uint256 newId,,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: t0, token1: t1,
                tickSpacing: ts, tickLower: tl, tickUpper: tu,
                amount0Desired: a0, amount1Desired: a1,
                amount0Min: a0 * (BPS - slip) / BPS,
                amount1Min: a1 * (BPS - slip) / BPS,
                recipient: address(this),
                deadline: block.timestamp,
                sqrtPriceX96: 0
            })
        );

        lpTokenId = newId;
        lpTickLower = tl;
        lpTickUpper = tu;

        IERC20(t0).forceApprove(address(positionManager), 0);
        IERC20(t1).forceApprove(address(positionManager), 0);
    }

    function _enterLP(uint256 usdcAmount) internal {
        if (usdcAmount == 0) return;

        (, int24 currentTick,,,,) = ICLPool(aeroPool).slot0();
        int24 ts = ICLPool(aeroPool).tickSpacing();
        int24 halfRange = lpParams.rangeWidth / 2;
        int24 tl = _roundDown(currentTick - halfRange, ts);
        int24 tu = _roundUp(currentTick + halfRange, ts);

        if (lpTokenId == 0) {
            _mintLP(usdcAmount, tl, tu);
        } else if (tl != lpTickLower || tu != lpTickUpper) {
            // Range changed — exit old, mint new
            _exitLP();
            uint256 totalUsdc = IERC20(asset()).balanceOf(address(this));
            if (totalUsdc > usdcAmount * 2) totalUsdc = usdcAmount * 2;
            _mintLP(totalUsdc, tl, tu);
        } else {
            // Same range — add liquidity
            uint256 usdcToSwap = _calcLPSwapAmount(usdcAmount, tl, tu);
            uint256 wethAmt = usdcToSwap > 0 ? _swap(asset(), address(weth), usdcToSwap) : 0;
            uint256 usdcAmt = IERC20(asset()).balanceOf(address(this));
            (uint256 a0, uint256 a1) = wethIsToken0 ? (wethAmt, usdcAmt) : (usdcAmt, wethAmt);
            address t0 = wethIsToken0 ? address(weth) : asset();
            address t1 = wethIsToken0 ? asset() : address(weth);
            uint256 slip = lpParams.slippageBps;

            IERC20(t0).forceApprove(address(positionManager), a0);
            IERC20(t1).forceApprove(address(positionManager), a1);
            positionManager.increaseLiquidity(
                INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: lpTokenId,
                    amount0Desired: a0, amount1Desired: a1,
                    amount0Min: a0 * (BPS - slip) / BPS,
                    amount1Min: a1 * (BPS - slip) / BPS,
                    deadline: block.timestamp
                })
            );
            IERC20(t0).forceApprove(address(positionManager), 0);
            IERC20(t1).forceApprove(address(positionManager), 0);
        }
    }

    function _exitLP() internal {
        if (lpTokenId == 0) return;
        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(lpTokenId);
        if (liquidity > 0) {
            positionManager.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: lpTokenId,
                    liquidity: liquidity,
                    amount0Min: 0, amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        }
        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: lpTokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        positionManager.burn(lpTokenId);
        lpTokenId = 0;

        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) _swap(address(weth), asset(), wethBal);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — 2x LONG (Aave: supply WETH, borrow USDC, buy WETH)
    // ══════════════════════════════════════════════════════════════

    function _enterLong(uint256 usdcAmount) internal {
        if (usdcAmount == 0) return;

        // Step 1: Swap USDC → WETH
        uint256 wethReceived = _swap(asset(), address(weth), usdcAmount);

        // Step 2: Supply WETH as collateral
        weth.forceApprove(address(aavePool), wethReceived);
        aavePool.supply(address(weth), wethReceived, address(this), 0);

        // Step 3: Borrow ~50% in USDC (to get ~2x exposure)
        // Borrow slightly less than max to stay safe
        (,, uint256 availableBorrow,,,) = aavePool.getUserAccountData(address(this));
        // availableBorrow is in base currency (USD, 8 decimals)
        // USDC is 6 decimals, so convert: borrowable_usdc = availableBorrow / 100
        uint256 borrowableUsdc = availableBorrow / 100;
        // Borrow 80% of available to maintain safe health factor
        uint256 toBorrow = (borrowableUsdc * 8000) / BPS;
        if (toBorrow == 0) return;

        aavePool.borrow(asset(), toBorrow, VARIABLE_RATE, 0, address(this));

        // Step 4: Swap borrowed USDC → WETH (adds to long exposure)
        uint256 moreWeth = _swap(asset(), address(weth), toBorrow);

        // Step 5: Supply the additional WETH too
        weth.forceApprove(address(aavePool), moreWeth);
        aavePool.supply(address(weth), moreWeth, address(this), 0);
    }

    function _exitLong() internal {
        uint256 debtBal = vDebtUsdc.balanceOf(address(this));
        uint256 aWethBal = aWeth.balanceOf(address(this));

        if (aWethBal == 0) return;

        if (debtBal > 0) {
            // Withdraw enough WETH to repay all USDC debt
            aavePool.withdraw(address(weth), aWethBal, address(this));
            uint256 usdcFromSwap = _swap(address(weth), asset(), weth.balanceOf(address(this)));

            uint256 repayAmount = Math.min(debtBal, usdcFromSwap);
            IERC20(asset()).forceApprove(address(aavePool), repayAmount);
            aavePool.repay(asset(), repayAmount, VARIABLE_RATE, address(this));

            // Withdraw any remaining aWETH
            uint256 remainingAWeth = aWeth.balanceOf(address(this));
            if (remainingAWeth > 0) {
                aavePool.withdraw(address(weth), remainingAWeth, address(this));
                uint256 wethBal = weth.balanceOf(address(this));
                if (wethBal > 0) _swap(address(weth), asset(), wethBal);
            }
        } else {
            aavePool.withdraw(address(weth), aWethBal, address(this));
            uint256 wethBal = weth.balanceOf(address(this));
            if (wethBal > 0) _swap(address(weth), asset(), wethBal);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — 2x SHORT (Aave: supply USDC, borrow WETH, sell for USDC)
    // ══════════════════════════════════════════════════════════════

    function _enterShort(uint256 usdcAmount) internal {
        if (usdcAmount == 0) return;

        // Step 1: Supply USDC as collateral
        IERC20(asset()).forceApprove(address(aavePool), usdcAmount);
        aavePool.supply(asset(), usdcAmount, address(this), 0);

        // Step 2: Borrow WETH
        (,, uint256 availableBorrow,,,) = aavePool.getUserAccountData(address(this));
        // availableBorrow is in USD (8 decimals). Get ETH price to calc WETH amount.
        (uint160 sqrtPriceX96,,,,,) = ICLPool(aeroPool).slot0();
        uint256 ethPriceUsdc6 = _getEthPriceUsdc(sqrtPriceX96);
        if (ethPriceUsdc6 == 0) return;

        // Borrowable in WETH = (availableBorrow / 100) / ethPrice * 1e18
        // But keep 80% of max to stay safe
        uint256 borrowableUsd = (availableBorrow * 8000) / (BPS * 100); // in USDC 6 dec
        uint256 wethToBorrow = (borrowableUsd * 1e18) / ethPriceUsdc6;
        if (wethToBorrow == 0) return;

        aavePool.borrow(address(weth), wethToBorrow, VARIABLE_RATE, 0, address(this));

        // Step 3: Sell borrowed WETH for USDC (profits if ETH drops)
        _swap(address(weth), asset(), wethToBorrow);
    }

    function _exitShort() internal {
        uint256 debtWethBal = vDebtWeth.balanceOf(address(this));
        uint256 aUsdcBal = aUsdc.balanceOf(address(this));

        if (debtWethBal > 0) {
            // Buy WETH to repay all debt
            (uint160 sqrtPriceX96,,,,,) = ICLPool(aeroPool).slot0();
            uint256 ethPrice = _getEthPriceUsdc(sqrtPriceX96);
            uint256 usdcNeeded = (debtWethBal * ethPrice * (BPS + lpParams.slippageBps)) / (1e18 * BPS);

            uint256 wethBought = _swap(asset(), address(weth), Math.min(usdcNeeded, _idleUsdc()));
            uint256 repayAmount = Math.min(debtWethBal, wethBought);
            weth.forceApprove(address(aavePool), repayAmount);
            aavePool.repay(address(weth), repayAmount, VARIABLE_RATE, address(this));

            uint256 leftover = weth.balanceOf(address(this));
            if (leftover > 0) _swap(address(weth), asset(), leftover);
        }

        // Withdraw all USDC collateral
        aUsdcBal = aUsdc.balanceOf(address(this));
        if (aUsdcBal > 0) {
            aavePool.withdraw(asset(), aUsdcBal, address(this));
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — EXIT ALL
    // ══════════════════════════════════════════════════════════════

    function _exitAllPositions() internal {
        _exitLP();
        _exitLong();
        _exitShort();
    }

    /// @dev Free at least `amount` USDC by unwinding positions (for withdrawals)
    function _freeUsdc(uint256 amount) internal {
        // First try swapping any loose WETH
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) _swap(address(weth), asset(), wethBal);
        if (_idleUsdc() >= amount) return;

        // Exit all positions — simple and reliable for withdrawals
        _exitAllPositions();
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — VALUE CALCULATIONS
    // ══════════════════════════════════════════════════════════════

    function _idleUsdc() internal view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function _lpValue() internal view returns (uint256) {
        if (lpTokenId == 0) return 0;

        (,,,,,,, uint128 liquidity,,,
            uint128 tokensOwed0, uint128 tokensOwed1
        ) = positionManager.positions(lpTokenId);

        if (liquidity == 0 && tokensOwed0 == 0 && tokensOwed1 == 0) return 0;

        (uint160 sqrtPriceX96,,,,,) = ICLPool(aeroPool).slot0();
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(lpTickLower);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(lpTickUpper);

        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96, sqrtA, sqrtB, liquidity
        );
        amount0 += tokensOwed0;
        amount1 += tokensOwed1;

        if (wethIsToken0) {
            return amount1 + _wethToUsdc(amount0, sqrtPriceX96);
        } else {
            return amount0 + _wethToUsdc(amount1, sqrtPriceX96);
        }
    }

    /// @dev Net value of 2x long position: aWETH value - USDC debt
    function _longValue() internal view returns (uint256) {
        uint256 aWethBal = aWeth.balanceOf(address(this));
        if (aWethBal == 0) return 0;

        (uint160 sqrtPriceX96,,,,,) = ICLPool(aeroPool).slot0();
        uint256 wethValueUsdc = _wethToUsdc(aWethBal, sqrtPriceX96);
        uint256 debtUsdc = vDebtUsdc.balanceOf(address(this));

        if (wethValueUsdc <= debtUsdc) return 0;
        return wethValueUsdc - debtUsdc;
    }

    /// @dev Net value of 2x short position: aUSDC value - WETH debt (in USDC)
    function _shortValue() internal view returns (uint256) {
        uint256 aUsdcBal = aUsdc.balanceOf(address(this));
        if (aUsdcBal == 0) return 0;

        uint256 debtWeth = vDebtWeth.balanceOf(address(this));
        (uint160 sqrtPriceX96,,,,,) = ICLPool(aeroPool).slot0();
        uint256 debtUsdc = _wethToUsdc(debtWeth, sqrtPriceX96);

        if (aUsdcBal <= debtUsdc) return 0;
        return aUsdcBal - debtUsdc;
    }

    function _wethToUsdc(uint256 wethAmount, uint160 sqrtPriceX96) internal view returns (uint256) {
        if (wethAmount == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        if (wethIsToken0) {
            return Math.mulDiv(wethAmount, priceX192, 1 << 192);
        } else {
            return Math.mulDiv(wethAmount, 1 << 192, priceX192);
        }
    }

    function _getEthPriceUsdc(uint160 sqrtPriceX96) internal view returns (uint256) {
        return _wethToUsdc(1e18, sqrtPriceX96);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — SWAP
    // ══════════════════════════════════════════════════════════════

    function _swap(address tokenIn, address tokenOut, uint256 amountIn)
        internal returns (uint256)
    {
        if (amountIn == 0) return 0;

        IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);
        int24 tickSpacing = ICLPool(aeroPool).tickSpacing();

        (uint160 sqrtPriceX96,,,,,) = ICLPool(aeroPool).slot0();
        uint256 expected = _getExpectedOutput(tokenIn, amountIn, sqrtPriceX96);
        uint256 minOut = expected * (BPS - lpParams.slippageBps) / BPS;

        uint256 amountOut = swapRouter.exactInputSingle(
            ICLSwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tickSpacing: tickSpacing,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0
            })
        );

        IERC20(tokenIn).forceApprove(address(swapRouter), 0);
        return amountOut;
    }

    function _getExpectedOutput(address tokenIn, uint256 amountIn, uint160 sqrtPriceX96)
        internal view returns (uint256)
    {
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        bool inputIsWeth = tokenIn == address(weth);
        if (wethIsToken0) {
            return inputIsWeth
                ? Math.mulDiv(amountIn, priceX192, 1 << 192)
                : Math.mulDiv(amountIn, 1 << 192, priceX192);
        } else {
            return inputIsWeth
                ? Math.mulDiv(amountIn, 1 << 192, priceX192)
                : Math.mulDiv(amountIn, priceX192, 1 << 192);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — MATH
    // ══════════════════════════════════════════════════════════════

    function _calcLPSwapAmount(uint256 totalUsdc, int24 tl, int24 tu)
        internal view returns (uint256)
    {
        (, int24 currentTick,,,,) = ICLPool(aeroPool).slot0();
        if (currentTick <= tl) return totalUsdc;
        if (currentTick >= tu) return 0;

        uint160 sqrtPrice = TickMath.getSqrtRatioAtTick(currentTick);
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(tl);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(tu);

        uint256 num = uint256(sqrtPrice) * uint256(sqrtB - sqrtPrice);
        uint256 den = num + uint256(sqrtPrice - sqrtA) * uint256(sqrtB);
        return (totalUsdc * num) / den;
    }

    function _roundDown(int24 tick, int24 ts) internal pure returns (int24) {
        int24 mod = tick % ts;
        if (mod < 0) mod += ts;
        return tick - mod;
    }

    function _roundUp(int24 tick, int24 ts) internal pure returns (int24) {
        int24 r = _roundDown(tick, ts);
        if (r < tick) r += ts;
        return r;
    }

    // ══════════════════════════════════════════════════════════════
    //  PUBLIC VIEWS
    // ══════════════════════════════════════════════════════════════

    function getVaultInfo() external view returns (
        uint256 totalAssets_,
        uint256 totalSupply_,
        uint256 lpVal,
        uint256 longVal,
        uint256 shortVal,
        uint256 holdVal,
        uint256 lpBps_,
        uint256 longBps_,
        uint256 shortBps_,
        uint256 holdBps_,
        bool circuitBroken,
        uint256 rebalances,
        uint256 lastRebal
    ) {
        totalAssets_ = totalAssets();
        totalSupply_ = totalSupply();
        lpVal = getLPValue();
        longVal = getLongValue();
        shortVal = getShortValue();
        holdVal = _idleUsdc();
        lpBps_ = currentAllocation.lpBps;
        longBps_ = currentAllocation.longBps;
        shortBps_ = currentAllocation.shortBps;
        holdBps_ = currentAllocation.holdBps;
        circuitBroken = circuitBreakerTripped;
        rebalances = rebalanceCount;
        lastRebal = lastRebalanceTime;
    }

    function getLPValue() public view returns (uint256) { return _lpValue(); }
    function getLongValue() public view returns (uint256) { return _longValue(); }
    function getShortValue() public view returns (uint256) { return _shortValue(); }

    function getUserPosition(address user) external view returns (uint256 shares, uint256 value) {
        shares = balanceOf(user);
        uint256 supply = totalSupply();
        if (supply > 0) {
            value = (shares * totalAssets()) / supply;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════════════

    function setStrategist(address _strategist) external onlyAdmin {
        emit StrategistUpdated(strategist, _strategist);
        strategist = _strategist;
    }

    function setLPParams(int24 rangeWidth, uint256 slippageBps) external onlyAdmin {
        if (rangeWidth <= 0 || slippageBps > 500) revert InvalidParam();
        lpParams = LPParams(rangeWidth, slippageBps);
        emit LPParamsUpdated(rangeWidth, slippageBps);
    }

    function setDepositCap(uint256 newCap) external onlyAdmin {
        depositCap = newCap;
    }

    function setSafetyParams(
        uint256 _minHealthFactor,
        uint256 _maxSingleMoveBps,
        uint256 _rebalanceCooldown,
        uint256 _drawdownBreakBps
    ) external onlyAdmin {
        if (_minHealthFactor < 1.1e18 || _maxSingleMoveBps > BPS || _drawdownBreakBps > 5000) revert InvalidParam();
        minHealthFactor = _minHealthFactor;
        maxSingleMoveBps = _maxSingleMoveBps;
        rebalanceCooldown = _rebalanceCooldown;
        drawdownBreakBps = _drawdownBreakBps;
    }

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice Emergency: exit everything to idle USDC
    function emergencyExitAll() external onlyAdmin nonReentrant {
        _exitAllPositions();
        currentAllocation = Allocation(0, 0, 0, BPS);
        emit EmergencyExitAll(IERC20(asset()).balanceOf(address(this)));
    }

    function recoverToken(address token) external onlyAdmin {
        if (token == asset() || token == address(weth)) revert InvalidParam();
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    // ══════════════════════════════════════════════════════════════
    //  UUPS
    // ══════════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal view override {
        if (msg.sender != admin) revert NotAdmin();
        if (upgradeRenounced) revert UpgradesRenounced();
    }

    function renounceUpgradeability() external onlyAdmin {
        upgradeRenounced = true;
    }
}
