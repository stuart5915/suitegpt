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
import "./libraries/TickMath.sol";
import "./libraries/LiquidityAmounts.sol";

/// @title BasisVault — Managed Aerodrome CL Vault (Deposit USDC, Earn Yield)
/// @notice ERC-4626 vault that provides concentrated liquidity on Aerodrome.
///         Strategy parameters are set by admin. Rebalance and compound are
///         permissionless — anyone can call them when on-chain conditions are met.
///         Performance fee on yield is routed to BasisFeeManager.
///         UUPS upgradeable. Withdrawals never pause. Deposit cap enforced.
contract BasisVault is
    Initializable,
    ERC4626Upgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  STRUCTS
    // ══════════════════════════════════════════════════════════════

    struct StrategyParams {
        int24 rangeWidth;           // total tick range width (e.g. 1000 = ±500 ticks ≈ ±5%)
        int24 rebalanceBuffer;      // extra ticks outside range before rebalance triggers
        address pool;               // whitelisted Aerodrome CL pool
        uint256 compoundMinimum;    // min idle USDC before compound is worth gas
        uint256 slippageTolerance;  // max slippage in bps (e.g. 50 = 0.5%)
    }

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    // Aerodrome contracts
    INonfungiblePositionManager public positionManager;
    ICLSwapRouter public swapRouter;
    IERC20 public weth;

    // Current LP position (0 = no position)
    uint256 public tokenId;
    int24 public currentTickLower;
    int24 public currentTickUpper;

    // Strategy
    StrategyParams public strategy;

    // Fees
    address public feeManager;
    uint256 public performanceFeeBps; // e.g. 1500 = 15%

    // Deposit cap
    uint256 public depositCap;

    // Admin
    address public admin;
    bool public upgradeRenounced;

    // Token ordering: true if WETH < USDC by address (WETH is token0)
    bool public wethIsToken0;

    // Counters for dashboard
    uint256 public rebalanceCount;
    uint256 public lastRebalanceTime;
    uint256 public compoundCount;
    uint256 public lastCompoundTime;
    uint256 public totalFeesEarnedUsdc;

    // Reserve storage slots for future upgrades
    uint256[45] private __gap;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event RebalanceExecuted(
        int24 oldTickLower, int24 oldTickUpper,
        int24 newTickLower, int24 newTickUpper
    );
    event Compounded(uint256 feesCollected0, uint256 feesCollected1, uint256 idleDeployed);
    event ParametersUpdated(int24 rangeWidth, int24 rebalanceBuffer, address pool);
    event DepositCapUpdated(uint256 newCap);
    event PerformanceFeeUpdated(uint256 newFeeBps);
    event FeeManagerUpdated(address indexed newFeeManager);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event UpgradeRenounced();
    event EmergencyExitLP(uint256 usdcRecovered);

    // ══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdc,
        address _weth,
        address _positionManager,
        address _swapRouter,
        address _admin,
        address _feeManager,
        uint256 _depositCap
    ) external initializer {
        require(_usdc != address(0), "zero usdc");
        require(_weth != address(0), "zero weth");
        require(_positionManager != address(0), "zero pm");
        require(_swapRouter != address(0), "zero router");
        require(_admin != address(0), "zero admin");
        require(_feeManager != address(0), "zero fee mgr");

        __ERC20_init("Basis USDC Vault", "bUSDC");
        __ERC4626_init(IERC20(_usdc));
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        weth = IERC20(_weth);
        positionManager = INonfungiblePositionManager(_positionManager);
        swapRouter = ICLSwapRouter(_swapRouter);
        admin = _admin;
        feeManager = _feeManager;
        depositCap = _depositCap;
        performanceFeeBps = 1500; // 15% default

        wethIsToken0 = _weth < _usdc;
    }

    function version() external pure returns (uint256) { return 1; }

    // ══════════════════════════════════════════════════════════════
    //  ERC-721 RECEIVER (for Aerodrome position NFTs)
    // ══════════════════════════════════════════════════════════════

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // ══════════════════════════════════════════════════════════════
    //  ERC-4626 OVERRIDES
    // ══════════════════════════════════════════════════════════════

    /// @notice Total USDC controlled by this vault (idle + LP position value).
    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 lpValue = _getLPValueInUsdc();
        return idle + lpValue;
    }

    /// @notice Enforce deposit cap and pause.
    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 total = totalAssets();
        if (total >= depositCap) return 0;
        return depositCap - total;
    }

    /// @notice Enforce deposit cap and pause for mint.
    function maxMint(address receiver) public view override returns (uint256) {
        uint256 maxAssets = maxDeposit(receiver);
        return _convertToShares(maxAssets, Math.Rounding.Floor);
    }

    /// @dev Override to add pause + deposit cap check.
    function _deposit(
        address caller,
        address receiver,
        uint256 assets,
        uint256 shares
    ) internal override nonReentrant whenNotPaused {
        require(totalAssets() + assets <= depositCap, "deposit cap");
        super._deposit(caller, receiver, assets, shares);
    }

    /// @dev Override to free USDC from LP if idle balance is insufficient.
    ///      Withdrawals are NEVER paused.
    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override nonReentrant {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) {
            _removeLiquidityForUsdc(assets - idle);
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    // ══════════════════════════════════════════════════════════════
    //  PERMISSIONLESS OPERATIONS
    // ══════════════════════════════════════════════════════════════

    /// @notice Deploy idle USDC into the Aerodrome LP position.
    ///         Creates a new position if none exists, or adds to existing.
    ///         Reverts if position is out of range (call rebalance() first).
    function compound() external nonReentrant {
        require(strategy.pool != address(0), "no pool set");

        uint256 fees0;
        uint256 fees1;

        if (tokenId != 0) {
            require(_isInRange(), "out of range");
            (fees0, fees1) = _collectFees();
            _takePerformanceFee(fees0, fees1);
        }

        uint256 idle = IERC20(asset()).balanceOf(address(this));
        require(idle >= strategy.compoundMinimum, "below minimum");

        if (tokenId == 0) {
            _mintNewPosition(idle);
        } else {
            _addToPosition(idle);
        }

        compoundCount++;
        lastCompoundTime = block.timestamp;

        emit Compounded(fees0, fees1, idle);
    }

    /// @notice Re-center the LP position on the current tick.
    ///         Only callable when position is out of range + buffer.
    function rebalance() external nonReentrant {
        require(tokenId != 0, "no position");

        (, int24 currentTick,,,,) = ICLPool(strategy.pool).slot0();
        require(
            currentTick < currentTickLower - strategy.rebalanceBuffer ||
            currentTick > currentTickUpper + strategy.rebalanceBuffer,
            "not eligible"
        );

        int24 oldLower = currentTickLower;
        int24 oldUpper = currentTickUpper;

        // 1. Remove all liquidity
        _removeAllLiquidity();

        // 2. Collect all fees + tokens
        (uint256 fees0, uint256 fees1) = _collectAll();
        _takePerformanceFee(fees0, fees1);

        // 3. Burn old NFT
        positionManager.burn(tokenId);
        tokenId = 0;

        // 4. Consolidate to USDC
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            _swap(address(weth), asset(), wethBal);
        }

        // 5. Mint new position centered on current tick
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle > 0) {
            _mintNewPosition(idle);
        }

        rebalanceCount++;
        lastRebalanceTime = block.timestamp;

        emit RebalanceExecuted(oldLower, oldUpper, currentTickLower, currentTickUpper);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — PARAMETERS
    // ══════════════════════════════════════════════════════════════

    function setParameters(
        int24 rangeWidth,
        int24 rebalanceBuffer,
        address pool,
        uint256 compoundMinimum,
        uint256 slippageTolerance
    ) external onlyAdmin {
        require(rangeWidth > 0, "zero range");
        require(pool != address(0), "zero pool");
        require(slippageTolerance <= 1000, "slippage > 10%");

        strategy = StrategyParams({
            rangeWidth: rangeWidth,
            rebalanceBuffer: rebalanceBuffer,
            pool: pool,
            compoundMinimum: compoundMinimum,
            slippageTolerance: slippageTolerance
        });

        emit ParametersUpdated(rangeWidth, rebalanceBuffer, pool);
    }

    function setDepositCap(uint256 newCap) external onlyAdmin {
        depositCap = newCap;
        emit DepositCapUpdated(newCap);
    }

    function setPerformanceFee(uint256 newFeeBps) external onlyAdmin {
        require(newFeeBps <= 3000, "fee > 30%");
        performanceFeeBps = newFeeBps;
        emit PerformanceFeeUpdated(newFeeBps);
    }

    function setFeeManager(address newFeeManager) external onlyAdmin {
        require(newFeeManager != address(0), "zero address");
        feeManager = newFeeManager;
        emit FeeManagerUpdated(newFeeManager);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — CONTROLS
    // ══════════════════════════════════════════════════════════════

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice Pull all liquidity out of Aerodrome back to idle USDC.
    ///         Withdrawals continue to work normally after this.
    function emergencyExitLP() external onlyAdmin {
        if (tokenId == 0) return;

        _removeAllLiquidity();
        _collectAll();
        positionManager.burn(tokenId);
        tokenId = 0;

        // Swap all WETH back to USDC
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            _swap(address(weth), asset(), wethBal);
        }

        emit EmergencyExitLP(IERC20(asset()).balanceOf(address(this)));
    }

    /// @notice Rescue tokens accidentally sent to contract.
    ///         Cannot touch USDC (asset), WETH, or the LP NFT.
    function recoverToken(address token) external onlyAdmin {
        require(token != asset(), "cannot recover asset");
        require(token != address(weth), "cannot recover weth");
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    // ══════════════════════════════════════════════════════════════
    //  UUPS UPGRADE CONTROL
    // ══════════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal view override {
        require(msg.sender == admin, "not admin");
        require(!upgradeRenounced, "upgrades renounced");
    }

    function renounceUpgradeability() external onlyAdmin {
        upgradeRenounced = true;
        emit UpgradeRenounced();
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — LP POSITION VALUE
    // ══════════════════════════════════════════════════════════════

    /// @dev Total USDC value of the current LP position (principal + uncollected fees).
    function _getLPValueInUsdc() internal view returns (uint256) {
        if (tokenId == 0) return 0;

        (,,,,,,, uint128 liquidity,,,
            uint128 tokensOwed0, uint128 tokensOwed1
        ) = positionManager.positions(tokenId);

        if (liquidity == 0 && tokensOwed0 == 0 && tokensOwed1 == 0) return 0;

        (uint160 sqrtPriceX96,,,,,) = ICLPool(strategy.pool).slot0();

        // Calculate amounts from liquidity
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(currentTickLower);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(currentTickUpper);
        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96, sqrtA, sqrtB, liquidity
        );

        // Add uncollected fees
        amount0 += tokensOwed0;
        amount1 += tokensOwed1;

        // Convert to USDC value
        if (wethIsToken0) {
            // token0 = WETH, token1 = USDC
            return amount1 + _wethToUsdc(amount0, sqrtPriceX96);
        } else {
            // token0 = USDC, token1 = WETH
            return amount0 + _wethToUsdc(amount1, sqrtPriceX96);
        }
    }

    /// @dev Convert WETH amount to USDC using pool price.
    function _wethToUsdc(uint256 wethAmount, uint160 sqrtPriceX96) internal view returns (uint256) {
        if (wethAmount == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);

        if (wethIsToken0) {
            // price = token1/token0 = USDC/WETH
            return Math.mulDiv(wethAmount, priceX192, 1 << 192);
        } else {
            // price = token0/token1 = USDC/WETH — invert
            return Math.mulDiv(wethAmount, 1 << 192, priceX192);
        }
    }

    /// @dev Check if current pool tick is within the position's range.
    function _isInRange() internal view returns (bool) {
        (, int24 currentTick,,,,) = ICLPool(strategy.pool).slot0();
        return currentTick >= currentTickLower && currentTick < currentTickUpper;
    }

    // ══════════════════════════════════════════════════════════════
    //  PUBLIC VIEWS — DASHBOARD
    // ══════════════════════════════════════════════════════════════

    /// @notice Whether the current LP position is in range.
    function isInRange() public view returns (bool) {
        if (tokenId == 0) return false;
        return _isInRange();
    }

    /// @notice All key vault data in a single RPC call for dashboard.
    function getVaultInfo() external view returns (
        uint256 _totalAssets,
        uint256 _totalSupply,
        int24 _tickLower,
        int24 _tickUpper,
        bool _inRange,
        uint256 _rebalanceCount,
        uint256 _lastRebalanceTime,
        uint256 _compoundCount,
        uint256 _lastCompoundTime,
        uint256 _totalFeesEarned,
        uint256 _depositCap,
        uint256 _performanceFeeBps,
        bool _paused
    ) {
        _totalAssets = totalAssets();
        _totalSupply = totalSupply();
        _tickLower = currentTickLower;
        _tickUpper = currentTickUpper;
        _inRange = tokenId != 0 ? _isInRange() : false;
        _rebalanceCount = rebalanceCount;
        _lastRebalanceTime = lastRebalanceTime;
        _compoundCount = compoundCount;
        _lastCompoundTime = lastCompoundTime;
        _totalFeesEarned = totalFeesEarnedUsdc;
        _depositCap = depositCap;
        _performanceFeeBps = performanceFeeBps;
        _paused = paused();
    }

    /// @notice Returns a user's shares and their USDC value.
    function getUserPosition(address user) external view returns (
        uint256 shares,
        uint256 value
    ) {
        shares = balanceOf(user);
        uint256 supply = totalSupply();
        if (supply > 0) {
            value = (shares * totalAssets()) / supply;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — LP OPERATIONS
    // ══════════════════════════════════════════════════════════════

    /// @dev Create a new LP position centered on the current tick.
    function _mintNewPosition(uint256 usdcAmount) internal {
        (, int24 currentTick,,,,) = ICLPool(strategy.pool).slot0();
        int24 ts = ICLPool(strategy.pool).tickSpacing();

        int24 tl = _roundDownToSpacing(currentTick - strategy.rangeWidth / 2, ts);
        int24 tu = _roundUpToSpacing(currentTick + strategy.rangeWidth / 2, ts);

        _swapAndMint(usdcAmount, tl, tu, ts);

        currentTickLower = tl;
        currentTickUpper = tu;
    }

    /// @dev Swap USDC to balanced ratio, then mint LP position.
    function _swapAndMint(uint256 usdcAmount, int24 tl, int24 tu, int24 ts) internal {
        uint256 usdcToSwap = _calculateSwapAmount(usdcAmount, tl, tu);
        uint256 wethAmt = usdcToSwap > 0 ? _swap(asset(), address(weth), usdcToSwap) : 0;
        uint256 usdcAmt = IERC20(asset()).balanceOf(address(this));

        (uint256 a0, uint256 a1) = wethIsToken0 ? (wethAmt, usdcAmt) : (usdcAmt, wethAmt);
        uint256 slip = strategy.slippageTolerance;

        address t0 = wethIsToken0 ? address(weth) : asset();
        address t1 = wethIsToken0 ? asset() : address(weth);
        IERC20(t0).forceApprove(address(positionManager), a0);
        IERC20(t1).forceApprove(address(positionManager), a1);

        (uint256 newId,,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: t0,
                token1: t1,
                tickSpacing: ts,
                tickLower: tl,
                tickUpper: tu,
                amount0Desired: a0,
                amount1Desired: a1,
                amount0Min: a0 * (10000 - slip) / 10000,
                amount1Min: a1 * (10000 - slip) / 10000,
                recipient: address(this),
                deadline: block.timestamp,
                sqrtPriceX96: 0
            })
        );

        tokenId = newId;
        IERC20(t0).forceApprove(address(positionManager), 0);
        IERC20(t1).forceApprove(address(positionManager), 0);
    }

    /// @dev Add idle USDC to the existing LP position.
    function _addToPosition(uint256 usdcAmount) internal {
        // Calculate swap amount for current range
        uint256 usdcToSwap = _calculateSwapAmount(usdcAmount, currentTickLower, currentTickUpper);

        uint256 wethAmount;
        if (usdcToSwap > 0) {
            wethAmount = _swap(asset(), address(weth), usdcToSwap);
        }
        uint256 usdcRemaining = IERC20(asset()).balanceOf(address(this));

        (uint256 amount0Desired, uint256 amount1Desired) = wethIsToken0
            ? (wethAmount, usdcRemaining)
            : (usdcRemaining, wethAmount);

        uint256 slip = strategy.slippageTolerance;
        uint256 amount0Min = amount0Desired * (10000 - slip) / 10000;
        uint256 amount1Min = amount1Desired * (10000 - slip) / 10000;

        address token0 = wethIsToken0 ? address(weth) : asset();
        address token1 = wethIsToken0 ? asset() : address(weth);

        IERC20(token0).forceApprove(address(positionManager), amount0Desired);
        IERC20(token1).forceApprove(address(positionManager), amount1Desired);

        positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: amount0Min,
                amount1Min: amount1Min,
                deadline: block.timestamp
            })
        );

        IERC20(token0).forceApprove(address(positionManager), 0);
        IERC20(token1).forceApprove(address(positionManager), 0);
    }

    /// @dev Remove enough liquidity to free at least `usdcNeeded` USDC.
    function _removeLiquidityForUsdc(uint256 usdcNeeded) internal {
        if (tokenId == 0) return;

        uint256 lpValue = _getLPValueInUsdc();
        if (lpValue == 0) return;

        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(tokenId);

        // Remove proportional liquidity + 2% buffer for swap slippage
        uint256 fraction = Math.min(
            (usdcNeeded * 10200 * 1e18) / (lpValue * 10000),
            1e18
        );
        uint128 liquidityToRemove = uint128(uint256(liquidity) * fraction / 1e18);
        if (liquidityToRemove == 0) liquidityToRemove = 1;

        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidityToRemove,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );

        // Collect the tokens
        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        // Swap WETH to USDC
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            _swap(address(weth), asset(), wethBal);
        }

        // If all liquidity was removed, burn the NFT
        (,,,,,,, uint128 remaining,,,,) = positionManager.positions(tokenId);
        if (remaining == 0) {
            positionManager.burn(tokenId);
            tokenId = 0;
        }
    }

    /// @dev Remove ALL liquidity from the current position.
    function _removeAllLiquidity() internal {
        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(tokenId);
        if (liquidity == 0) return;

        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId,
                liquidity: liquidity,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp
            })
        );
    }

    /// @dev Collect accrued trading fees from the position.
    function _collectFees() internal returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }

    /// @dev Collect ALL tokens (after decreaseLiquidity + fees).
    function _collectAll() internal returns (uint256 amount0, uint256 amount1) {
        return _collectFees();
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — FEES
    // ══════════════════════════════════════════════════════════════

    /// @dev Take performance fee on collected Aerodrome trading fees.
    ///      Converts WETH fees to USDC, takes %, sends to feeManager.
    function _takePerformanceFee(uint256 fees0, uint256 fees1) internal {
        if (performanceFeeBps == 0 || feeManager == address(0)) return;

        // Determine which fees are WETH and which are USDC
        uint256 wethFees;
        uint256 usdcFees;
        if (wethIsToken0) {
            wethFees = fees0;
            usdcFees = fees1;
        } else {
            wethFees = fees1;
            usdcFees = fees0;
        }

        // Swap WETH fees to USDC
        if (wethFees > 0) {
            uint256 swapped = _swap(address(weth), asset(), wethFees);
            usdcFees += swapped;
        }

        // Track total fees earned (before fee cut)
        totalFeesEarnedUsdc += usdcFees;

        // Take performance fee
        uint256 fee = (usdcFees * performanceFeeBps) / 10000;
        if (fee > 0) {
            IERC20(asset()).safeTransfer(feeManager, fee);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — SWAP & MATH
    // ══════════════════════════════════════════════════════════════

    /// @dev Swap tokens via Aerodrome router with slippage protection.
    function _swap(address tokenIn, address tokenOut, uint256 amountIn)
        internal returns (uint256 amountOut)
    {
        if (amountIn == 0) return 0;

        IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);

        int24 tickSpacing = ICLPool(strategy.pool).tickSpacing();

        // Calculate expected output for slippage protection
        (uint160 sqrtPriceX96,,,,,) = ICLPool(strategy.pool).slot0();
        uint256 expected = _getExpectedOutput(tokenIn, amountIn, sqrtPriceX96);
        uint256 minOut = expected * (10000 - strategy.slippageTolerance) / 10000;

        amountOut = swapRouter.exactInputSingle(
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
    }

    /// @dev Estimate swap output using current pool price.
    function _getExpectedOutput(address tokenIn, uint256 amountIn, uint160 sqrtPriceX96)
        internal view returns (uint256)
    {
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        bool inputIsWeth = tokenIn == address(weth);

        if (wethIsToken0) {
            // price = USDC/WETH
            if (inputIsWeth) {
                return Math.mulDiv(amountIn, priceX192, 1 << 192);
            } else {
                return Math.mulDiv(amountIn, 1 << 192, priceX192);
            }
        } else {
            // price = WETH/USDC (inverted)
            if (inputIsWeth) {
                return Math.mulDiv(amountIn, 1 << 192, priceX192);
            } else {
                return Math.mulDiv(amountIn, priceX192, 1 << 192);
            }
        }
    }

    /// @dev Calculate how much USDC to swap to WETH for a balanced LP deposit.
    ///      Uses the concentrated liquidity ratio formula:
    ///      fraction_weth = S*(Sb-S) / [S*(Sb-S) + (S-Sa)*Sb]
    ///      where S = current sqrtPrice, Sa = sqrtPrice at tickLower, Sb = sqrtPrice at tickUpper.
    function _calculateSwapAmount(
        uint256 totalUsdc,
        int24 tickLower,
        int24 tickUpper
    ) internal view returns (uint256 usdcToSwap) {
        (, int24 currentTick,,,,) = ICLPool(strategy.pool).slot0();

        // If price is below range, all WETH needed
        if (currentTick <= tickLower) return totalUsdc;
        // If price is above range, all USDC needed
        if (currentTick >= tickUpper) return 0;

        uint160 sqrtPrice = TickMath.getSqrtRatioAtTick(currentTick);
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(tickUpper);

        // Fraction of total value that should be WETH:
        // num = sqrtPrice * (sqrtB - sqrtPrice)
        // den = num + (sqrtPrice - sqrtA) * sqrtB
        uint256 num = uint256(sqrtPrice) * uint256(sqrtB - sqrtPrice);
        uint256 den = num + uint256(sqrtPrice - sqrtA) * uint256(sqrtB);

        usdcToSwap = (totalUsdc * num) / den;
    }

    /// @dev Round tick down to nearest multiple of tickSpacing.
    function _roundDownToSpacing(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        int24 mod = tick % tickSpacing;
        if (mod < 0) mod += tickSpacing;
        return tick - mod;
    }

    /// @dev Round tick up to nearest multiple of tickSpacing.
    function _roundUpToSpacing(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        int24 rounded = _roundDownToSpacing(tick, tickSpacing);
        if (rounded < tick) rounded += tickSpacing;
        return rounded;
    }
}
