// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IAerodromeCL.sol";
import "./interfaces/IAaveV3.sol";
import "./libraries/TickMath.sol";
import "./libraries/LiquidityAmounts.sol";
import "./libraries/BrainMath.sol";

/// @title Chainlink Price Feed Interface (minimal)
interface IChainlinkFeed {
    function latestRoundData()
        external view returns (uint80, int256 answer, uint256, uint256 updatedAt, uint80);
    function decimals() external view returns (uint8);
}

/// @title AutoVault3Mode — 3-Mode Permissionless ERC-4626 Vault (ETH/USDC on Base)
/// @notice Switches between LP (Aerodrome CL), 2x Long (Aave), and 2x Short (Aave)
///         based on on-chain brain logic (SMA crossover + volatility + momentum).
///         Fully permissionless — no admin, no owner, no pausing, no upgrades.
contract AutoVault3Mode is ERC4626, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ── Custom Errors ──
    error TooSoon();
    error BadPrice();
    error StaleFeed();
    error NeedMorePrices();
    error NoChangeNeeded();
    error ZeroDeposit();
    error ZeroShares();
    error InsufficientShares();
    error LPModeOnly();
    error NoPosition();
    error NoAero();
    error InvalidOffset();

    // ── Enums ──
    enum Mode { LP, LONG, SHORT }

    // ── Constants (internal to save bytecode — no auto-generated getters) ──
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;

    INonfungiblePositionManager internal constant NPM =
        INonfungiblePositionManager(0x827922686190790b37229fd06084350E74485b72);
    ICLSwapRouter internal constant ROUTER =
        ICLSwapRouter(0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5);
    ICLPool internal constant POOL =
        ICLPool(0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59);
    ICLGauge internal constant GAUGE =
        ICLGauge(0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8);
    IAaveV3Pool internal constant AAVE =
        IAaveV3Pool(0xA238Dd80C259a72e81d7e4664a9801593F98d1c5);
    IChainlinkFeed internal constant PRICE_FEED =
        IChainlinkFeed(0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70);

    // Aave aToken and debt token addresses on Base
    address internal constant A_WETH = 0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7;
    address internal constant DEBT_USDC = 0x59dca05B6c26Dbd64b5381374abB6dC0acfF72ca;
    address internal constant A_USDC = 0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB;
    address internal constant DEBT_WETH = 0x24e6e0795b3c7c71D965fCc4f371803d1c1DcA1E;

    // WETH (0x4200..0006) < USDC (0x8335..2913), so WETH is token0
    int24 internal constant TICK_SPACING = 100;

    // Brain parameters
    uint256 internal constant FAST_SMA = 4;
    uint256 internal constant SLOW_SMA = 14;
    uint256 internal constant MOM_THRESHOLD = 3;   // 0.3% = 3/1000
    uint256 internal constant VOL_THRESHOLD = 80;  // 80% annualized
    uint256 private constant VARIABLE_RATE = 2;

    // ── State ──
    Mode public currentMode;
    uint256 public tokenId;
    int24 public tickLower;
    int24 public tickUpper;
    uint256 public ethReserve;
    uint256[14] public priceHistory;
    uint256 public priceCount;
    uint256 public lastPriceUpdate;

    // ── Events ──
    event Deposited(address indexed user, uint256 usdcAmt, uint256 ethAmt, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 wethOut, uint256 usdcOut);
    event ModeChanged(Mode oldMode, Mode newMode);
    event PriceUpdated(uint256 price, uint256 count);
    event Compounded(uint256 aeroIn, uint256 wethOut);

    // ══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    constructor()
        ERC20("Basis AutoVault 3Mode", "bv3USDC")
        ERC4626(IERC20(USDC))
    {
        currentMode = Mode.LP;
        tokenId = 0;
        tickLower = 0;
        tickUpper = 0;
        ethReserve = 0;
        priceCount = 0;
        lastPriceUpdate = 0;

        // Max-approve to Aerodrome router, NPM, and Aave
        IERC20(USDC).forceApprove(address(ROUTER), type(uint256).max);
        IERC20(USDC).forceApprove(address(NPM), type(uint256).max);
        IERC20(USDC).forceApprove(address(AAVE), type(uint256).max);
        IERC20(WETH).forceApprove(address(ROUTER), type(uint256).max);
        IERC20(WETH).forceApprove(address(NPM), type(uint256).max);
        IERC20(WETH).forceApprove(address(AAVE), type(uint256).max);
        IERC20(AERO).forceApprove(address(ROUTER), type(uint256).max);
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // ══════════════════════════════════════════════════════════════
    //  PRICE ORACLE
    // ══════════════════════════════════════════════════════════════

    /// @notice Record ETH price from Chainlink. Permissionless, once per 20 hours.
    function updatePrice() external nonReentrant {
        if (block.timestamp < lastPriceUpdate + 20 hours) revert TooSoon();

        (, int256 answer,, uint256 updatedAt,) = PRICE_FEED.latestRoundData();
        if (answer <= 0) revert BadPrice();
        if (block.timestamp - updatedAt >= 2 hours) revert StaleFeed();

        // Chainlink ETH/USD has 8 decimals → convert to 6 (USDC precision)
        uint8 fd = PRICE_FEED.decimals();
        uint256 price = fd > 6
            ? uint256(answer) / (10 ** (fd - 6))
            : uint256(answer) * (10 ** (6 - fd));

        uint256 idx = priceCount % 14;
        priceHistory[idx] = price;
        priceCount++;
        lastPriceUpdate = block.timestamp;

        emit PriceUpdated(price, priceCount);
    }

    // ══════════════════════════════════════════════════════════════
    //  BRAIN — checkAndSwitch()
    // ══════════════════════════════════════════════════════════════

    /// @notice Evaluate price history and switch mode if warranted. Permissionless.
    function checkAndSwitch() external nonReentrant {
        if (priceCount < SLOW_SMA) revert NeedMorePrices();

        uint256 cp = _getPrice(0);
        uint256 sma4 = _calculateSMA(FAST_SMA);
        uint256 sma14 = _calculateSMA(SLOW_SMA);
        uint256 vol = _calculateVolatility();
        int256 mom = _calculateMomentum();

        Mode newMode;
        if (vol > VOL_THRESHOLD) {
            newMode = Mode.LP;
        } else if (cp > sma4 && sma4 > sma14 && mom > int256(MOM_THRESHOLD)) {
            newMode = Mode.LONG;
        } else if (cp < sma4 && sma4 < sma14 && mom < -int256(MOM_THRESHOLD)) {
            newMode = Mode.SHORT;
        } else {
            newMode = Mode.LP;
        }

        if (newMode == currentMode) revert NoChangeNeeded();

        Mode oldMode = currentMode;

        // Close current position
        if (oldMode == Mode.LP) _closeLP();
        else if (oldMode == Mode.LONG) _closeLong();
        else _closeShort();

        // Open new position
        if (newMode == Mode.LP) _openLP();
        else if (newMode == Mode.LONG) _openLong();
        else _openShort();

        currentMode = newMode;
        emit ModeChanged(oldMode, newMode);
    }

    // ══════════════════════════════════════════════════════════════
    //  DEPOSIT
    // ══════════════════════════════════════════════════════════════

    /// @notice Deposit USDC and/or WETH. Behavior depends on current mode.
    function deposit(uint256 usdcAmount, uint256 ethAmount)
        external nonReentrant returns (uint256 shares)
    {
        if (usdcAmount == 0 && ethAmount == 0) revert ZeroDeposit();

        uint256 totalBefore = totalAssets();
        uint256 supplyBefore = totalSupply();

        if (usdcAmount > 0) IERC20(USDC).safeTransferFrom(msg.sender, address(this), usdcAmount);
        if (ethAmount > 0) IERC20(WETH).safeTransferFrom(msg.sender, address(this), ethAmount);

        if (currentMode == Mode.LP) _depositLP(usdcAmount, ethAmount);
        else if (currentMode == Mode.LONG) _depositLong(usdcAmount);
        else _depositShort(ethAmount);

        uint256 depositValue = _totalVaultValue() - totalBefore;
        shares = supplyBefore == 0 ? depositValue : (depositValue * supplyBefore) / totalBefore;
        if (shares == 0) revert ZeroShares();

        _mint(msg.sender, shares);
        emit Deposited(msg.sender, usdcAmount, ethAmount, shares);
    }

    function _depositLP(uint256 usdcAmount, uint256 ethAmount) internal {
        if (tokenId == 0) {
            if (ethAmount == 0) {
                ethAmount = _swapExact(USDC, WETH, usdcAmount / 2);
                usdcAmount = IERC20(USDC).balanceOf(address(this));
            }
            if (usdcAmount == 0) {
                usdcAmount = _swapExact(WETH, USDC, ethAmount / 2);
                ethAmount = IERC20(WETH).balanceOf(address(this));
            }

            int24 ct = _getCurrentTick();
            int24 tl = _roundToSpacing(ct - 2231);
            int24 tu = _roundToSpacing(ct + 1823);
            if (tl >= tu) tu = tl + TICK_SPACING;

            (uint256 nid,,,) = NPM.mint(INonfungiblePositionManager.MintParams({
                token0: WETH, token1: USDC, tickSpacing: TICK_SPACING,
                tickLower: tl, tickUpper: tu,
                amount0Desired: ethAmount, amount1Desired: usdcAmount,
                amount0Min: 0, amount1Min: 0,
                recipient: address(this), deadline: block.timestamp, sqrtPriceX96: 0
            }));
            tokenId = nid; tickLower = tl; tickUpper = tu;
            NPM.approve(address(GAUGE), tokenId);
            GAUGE.deposit(tokenId);
        } else {
            // Existing position: add whatever tokens we have (NPM handles ratio)
            ethReserve = 0;
            uint256 wb = IERC20(WETH).balanceOf(address(this));
            uint256 ub = IERC20(USDC).balanceOf(address(this));

            GAUGE.withdraw(tokenId);
            if (wb > 0 || ub > 0) {
                NPM.increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams({
                    tokenId: tokenId, amount0Desired: wb, amount1Desired: ub,
                    amount0Min: 0, amount1Min: 0, deadline: block.timestamp
                }));
            }
            NPM.approve(address(GAUGE), tokenId);
            GAUGE.deposit(tokenId);
        }
    }

    function _depositLong(uint256 usdcAmount) internal {
        if (usdcAmount > 0) _swapExact(USDC, WETH, IERC20(USDC).balanceOf(address(this)));
        uint256 wb = IERC20(WETH).balanceOf(address(this));
        if (wb > 0) AAVE.supply(WETH, wb, address(this), 0);
    }

    function _depositShort(uint256 ethAmount) internal {
        if (ethAmount > 0) _swapExact(WETH, USDC, IERC20(WETH).balanceOf(address(this)));
        uint256 ub = IERC20(USDC).balanceOf(address(this));
        if (ub > 0) AAVE.supply(USDC, ub, address(this), 0);
    }

    // ══════════════════════════════════════════════════════════════
    //  WITHDRAW
    // ══════════════════════════════════════════════════════════════

    /// @notice Withdraw proportional share of vault assets.
    function withdraw(uint256 shares) external nonReentrant {
        if (shares == 0) revert ZeroShares();
        if (balanceOf(msg.sender) < shares) revert InsufficientShares();

        uint256 proportion = (shares * 1e18) / totalSupply();
        uint256 wethOut; uint256 usdcOut;

        if (currentMode == Mode.LP) (wethOut, usdcOut) = _withdrawLP(proportion);
        else if (currentMode == Mode.LONG) (wethOut, usdcOut) = _withdrawLong(proportion);
        else (wethOut, usdcOut) = _withdrawShort(proportion);

        _burn(msg.sender, shares);
        if (wethOut > 0) IERC20(WETH).safeTransfer(msg.sender, wethOut);
        if (usdcOut > 0) IERC20(USDC).safeTransfer(msg.sender, usdcOut);
        emit Withdrawn(msg.sender, shares, wethOut, usdcOut);
    }

    function _withdrawLP(uint256 proportion) internal returns (uint256 wethOut, uint256 usdcOut) {
        if (tokenId != 0) {
            GAUGE.withdraw(tokenId);
            (,,,,,,, uint128 liq,,,,) = NPM.positions(tokenId);
            if (liq > 0) {
                uint128 lr = uint128((uint256(liq) * proportion) / 1e18);
                if (lr > 0) {
                    NPM.decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams({
                        tokenId: tokenId, liquidity: lr,
                        amount0Min: 0, amount1Min: 0, deadline: block.timestamp
                    }));
                }
            }
            (uint256 c0, uint256 c1) = NPM.collect(INonfungiblePositionManager.CollectParams({
                tokenId: tokenId, recipient: address(this),
                amount0Max: type(uint128).max, amount1Max: type(uint128).max
            }));
            wethOut = (c0 * proportion) / 1e18;
            usdcOut = (c1 * proportion) / 1e18;
            uint256 ew = c0 - wethOut; uint256 eu = c1 - usdcOut;

            (,,,,,,, uint128 rl,,,,) = NPM.positions(tokenId);
            if (rl > 0) {
                if (ew > 0 || eu > 0) {
                    NPM.increaseLiquidity(INonfungiblePositionManager.IncreaseLiquidityParams({
                        tokenId: tokenId, amount0Desired: ew, amount1Desired: eu,
                        amount0Min: 0, amount1Min: 0, deadline: block.timestamp
                    }));
                }
                NPM.approve(address(GAUGE), tokenId);
                GAUGE.deposit(tokenId);
            } else {
                NPM.burn(tokenId);
                tokenId = 0; tickLower = 0; tickUpper = 0;
                wethOut += ew; usdcOut += eu;
            }
        }
        uint256 ro = (ethReserve * proportion) / 1e18;
        if (ro > 0) { ethReserve -= ro; wethOut += ro; }
    }

    function _withdrawLong(uint256 proportion) internal returns (uint256 wethOut, uint256 usdcOut) {
        uint256 supplied = IAToken(A_WETH).balanceOf(address(this));
        uint256 debt = IVariableDebtToken(DEBT_USDC).balanceOf(address(this));
        uint256 dr = (debt * proportion) / 1e18;
        uint256 cw = (supplied * proportion) / 1e18;

        if (dr > 0) {
            (uint160 sp,,,,,) = POOL.slot0();
            uint256 wn = (_usdcToWeth(dr, sp) * 103) / 100;
            if (wn > cw) wn = cw;
            AAVE.withdraw(WETH, wn, address(this));
            _swapExact(WETH, USDC, IERC20(WETH).balanceOf(address(this)));
            uint256 ub = IERC20(USDC).balanceOf(address(this));
            AAVE.repay(USDC, ub < dr ? ub : dr, VARIABLE_RATE, address(this));
            uint256 rem = cw - wn;
            if (rem > 0) AAVE.withdraw(WETH, rem, address(this));
        } else if (cw > 0) {
            AAVE.withdraw(WETH, cw, address(this));
        }
        wethOut = IERC20(WETH).balanceOf(address(this));
        usdcOut = IERC20(USDC).balanceOf(address(this));
    }

    function _withdrawShort(uint256 proportion) internal returns (uint256 wethOut, uint256 usdcOut) {
        uint256 supplied = IAToken(A_USDC).balanceOf(address(this));
        uint256 debt = IVariableDebtToken(DEBT_WETH).balanceOf(address(this));
        uint256 dr = (debt * proportion) / 1e18;
        uint256 cw = (supplied * proportion) / 1e18;

        if (dr > 0) {
            (uint160 sp,,,,,) = POOL.slot0();
            uint256 un = (_wethToUsdc(dr, sp) * 103) / 100;
            if (un > cw) un = cw;
            AAVE.withdraw(USDC, un, address(this));
            _swapExact(USDC, WETH, IERC20(USDC).balanceOf(address(this)));
            uint256 wb = IERC20(WETH).balanceOf(address(this));
            AAVE.repay(WETH, wb < dr ? wb : dr, VARIABLE_RATE, address(this));
            uint256 rem = cw - un;
            if (rem > 0) AAVE.withdraw(USDC, rem, address(this));
        } else if (cw > 0) {
            AAVE.withdraw(USDC, cw, address(this));
        }
        wethOut = IERC20(WETH).balanceOf(address(this));
        usdcOut = IERC20(USDC).balanceOf(address(this));
    }

    // ══════════════════════════════════════════════════════════════
    //  COMPOUND (LP mode only)
    // ══════════════════════════════════════════════════════════════

    function compound() external nonReentrant {
        if (currentMode != Mode.LP) revert LPModeOnly();
        if (tokenId == 0) revert NoPosition();

        GAUGE.getReward(tokenId);
        uint256 ab = IERC20(AERO).balanceOf(address(this));
        if (ab == 0) revert NoAero();

        uint256 wr = _swapExact(AERO, WETH, ab);
        ethReserve += wr;
        emit Compounded(ab, wr);
    }

    // ══════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    function totalAssets() public view override returns (uint256) {
        return _totalVaultValue();
    }

    function isInRange() public view returns (bool) {
        if (currentMode != Mode.LP || tokenId == 0) return false;
        int24 ct = _getCurrentTick();
        return ct >= tickLower && ct < tickUpper;
    }

    function pendingAero() public view returns (uint256) {
        if (currentMode != Mode.LP || tokenId == 0) return 0;
        return GAUGE.earned(address(this), tokenId);
    }

    function getVaultInfo() external view returns (
        uint256 totalValue, Mode mode, bool inRange, uint256 _priceCount
    ) {
        totalValue = _totalVaultValue();
        mode = currentMode;
        inRange = isInRange();
        _priceCount = priceCount;
    }

    /// @notice Brain state: SMAs, vol, momentum.
    ///         priceHistory[] and priceCount are public for direct reads.
    function getBrainState() external view returns (uint256 sma4, uint256 sma14, uint256 vol, int256 momentum) {
        if (priceCount >= SLOW_SMA) {
            sma4 = _calculateSMA(FAST_SMA);
            sma14 = _calculateSMA(SLOW_SMA);
            vol = _calculateVolatility();
            momentum = _calculateMomentum();
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — Mode Switching
    // ══════════════════════════════════════════════════════════════

    function _closeLP() internal {
        if (tokenId == 0) return;
        GAUGE.withdraw(tokenId);

        (,,,,,,, uint128 liq,,,,) = NPM.positions(tokenId);
        if (liq > 0) {
            NPM.decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, liquidity: liq,
                amount0Min: 0, amount1Min: 0, deadline: block.timestamp
            }));
        }
        NPM.collect(INonfungiblePositionManager.CollectParams({
            tokenId: tokenId, recipient: address(this),
            amount0Max: type(uint128).max, amount1Max: type(uint128).max
        }));

        uint256 ab = IERC20(AERO).balanceOf(address(this));
        if (ab > 0) _swapExact(AERO, WETH, ab);

        NPM.burn(tokenId);
        tokenId = 0; tickLower = 0; tickUpper = 0; ethReserve = 0;
    }

    function _openLP() internal {
        uint256 wb = IERC20(WETH).balanceOf(address(this));
        uint256 ub = IERC20(USDC).balanceOf(address(this));

        if (wb == 0 && ub > 0) _swapExact(USDC, WETH, ub / 2);
        else if (ub == 0 && wb > 0) _swapExact(WETH, USDC, wb / 2);

        wb = IERC20(WETH).balanceOf(address(this));
        ub = IERC20(USDC).balanceOf(address(this));
        if (wb == 0 && ub == 0) return;

        int24 ct = _getCurrentTick();
        int24 tl = _roundToSpacing(ct - 2231);
        int24 tu = _roundToSpacing(ct + 1823);
        if (tl >= tu) tu = tl + TICK_SPACING;

        (uint256 nid,,,) = NPM.mint(INonfungiblePositionManager.MintParams({
            token0: WETH, token1: USDC, tickSpacing: TICK_SPACING,
            tickLower: tl, tickUpper: tu,
            amount0Desired: wb, amount1Desired: ub,
            amount0Min: 0, amount1Min: 0,
            recipient: address(this), deadline: block.timestamp, sqrtPriceX96: 0
        }));
        tokenId = nid; tickLower = tl; tickUpper = tu;
        NPM.approve(address(GAUGE), tokenId);
        GAUGE.deposit(tokenId);
    }

    function _openLong() internal {
        uint256 ub = IERC20(USDC).balanceOf(address(this));
        if (ub > 0) _swapExact(USDC, WETH, ub);

        uint256 wb = IERC20(WETH).balanceOf(address(this));
        if (wb == 0) return;

        AAVE.supply(WETH, wb, address(this), 0);

        // Borrow USDC at 50% of available (safe ~2x leverage)
        (,, uint256 avail,,,) = AAVE.getUserAccountData(address(this));
        // avail is 8 decimals (USD), convert to 6 decimals (USDC), take 50%
        uint256 borrow = (avail * 50) / (100 * 100);
        if (borrow > 0) {
            AAVE.borrow(USDC, borrow, VARIABLE_RATE, 0, address(this));
            uint256 bu = IERC20(USDC).balanceOf(address(this));
            if (bu > 0) {
                uint256 mw = _swapExact(USDC, WETH, bu);
                if (mw > 0) AAVE.supply(WETH, mw, address(this), 0);
            }
        }
    }

    function _closeLong() internal {
        uint256 debt = IVariableDebtToken(DEBT_USDC).balanceOf(address(this));
        uint256 supplied = IAToken(A_WETH).balanceOf(address(this));

        if (debt > 0 && supplied > 0) {
            (uint160 sp,,,,,) = POOL.slot0();
            uint256 wn = (_usdcToWeth(debt, sp) * 103) / 100;
            if (wn > supplied) wn = supplied;

            AAVE.withdraw(WETH, wn, address(this));
            _swapExact(WETH, USDC, IERC20(WETH).balanceOf(address(this)));

            uint256 ub = IERC20(USDC).balanceOf(address(this));
            AAVE.repay(USDC, ub < debt ? ub : debt, VARIABLE_RATE, address(this));

            if (IAToken(A_WETH).balanceOf(address(this)) > 0)
                AAVE.withdraw(WETH, type(uint256).max, address(this));
        } else if (supplied > 0) {
            AAVE.withdraw(WETH, type(uint256).max, address(this));
        }
    }

    function _openShort() internal {
        uint256 wb = IERC20(WETH).balanceOf(address(this));
        if (wb > 0) _swapExact(WETH, USDC, wb);

        uint256 ub = IERC20(USDC).balanceOf(address(this));
        if (ub == 0) return;

        AAVE.supply(USDC, ub, address(this), 0);

        // Borrow WETH at 50% of available
        (,, uint256 avail,,,) = AAVE.getUserAccountData(address(this));
        uint256 borrowUsd = (avail * 50) / 100;

        // Convert USD (8 dec) to WETH (18 dec) using Chainlink price
        (, int256 ethPrice,,,) = PRICE_FEED.latestRoundData();
        uint8 fd = PRICE_FEED.decimals();
        uint256 wethBorrow;
        if (fd >= 8) {
            wethBorrow = (borrowUsd * 1e18 * (10 ** (fd - 8))) / uint256(ethPrice);
        } else {
            wethBorrow = (borrowUsd * 1e18) / (uint256(ethPrice) * (10 ** (8 - fd)));
        }

        if (wethBorrow > 0) {
            AAVE.borrow(WETH, wethBorrow, VARIABLE_RATE, 0, address(this));
            uint256 bw = IERC20(WETH).balanceOf(address(this));
            if (bw > 0) {
                uint256 mu = _swapExact(WETH, USDC, bw);
                if (mu > 0) AAVE.supply(USDC, mu, address(this), 0);
            }
        }
    }

    function _closeShort() internal {
        uint256 debt = IVariableDebtToken(DEBT_WETH).balanceOf(address(this));
        uint256 supplied = IAToken(A_USDC).balanceOf(address(this));

        if (debt > 0 && supplied > 0) {
            (uint160 sp,,,,,) = POOL.slot0();
            uint256 un = (_wethToUsdc(debt, sp) * 103) / 100;
            if (un > supplied) un = supplied;

            AAVE.withdraw(USDC, un, address(this));
            _swapExact(USDC, WETH, IERC20(USDC).balanceOf(address(this)));

            uint256 wb = IERC20(WETH).balanceOf(address(this));
            AAVE.repay(WETH, wb < debt ? wb : debt, VARIABLE_RATE, address(this));

            if (IAToken(A_USDC).balanceOf(address(this)) > 0)
                AAVE.withdraw(USDC, type(uint256).max, address(this));
        } else if (supplied > 0) {
            AAVE.withdraw(USDC, type(uint256).max, address(this));
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — Brain Calculations (delegated to BrainMath library)
    // ══════════════════════════════════════════════════════════════

    function _getPrice(uint256 offset) internal view returns (uint256) {
        if (offset >= 14 || offset >= priceCount) revert InvalidOffset();
        return BrainMath.getPrice(priceHistory, priceCount, offset);
    }

    function _calculateSMA(uint256 period) internal view returns (uint256) {
        return BrainMath.calculateSMA(priceHistory, priceCount, period);
    }

    function _calculateVolatility() internal view returns (uint256) {
        return BrainMath.calculateVolatility(priceHistory, priceCount);
    }

    function _calculateMomentum() internal view returns (int256) {
        return BrainMath.calculateMomentum(priceHistory, priceCount);
    }


    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — Value Calculations
    // ══════════════════════════════════════════════════════════════

    function _totalVaultValue() internal view returns (uint256) {
        if (currentMode == Mode.LP) return _valLP();
        if (currentMode == Mode.LONG) return _valLong();
        return _valShort();
    }

    function _valLP() internal view returns (uint256) {
        uint256 ui = IERC20(USDC).balanceOf(address(this));
        uint256 wi = IERC20(WETH).balanceOf(address(this));
        (uint256 lw, uint256 lu) = _getPositionAmounts();
        uint256 tw = wi + lw + ethReserve;
        if (tw > 0) {
            (uint160 sp,,,,,) = POOL.slot0();
            return ui + lu + _wethToUsdc(tw, sp);
        }
        return ui + lu;
    }

    function _valLong() internal view returns (uint256) {
        uint256 sw = IAToken(A_WETH).balanceOf(address(this));
        uint256 du = IVariableDebtToken(DEBT_USDC).balanceOf(address(this));
        uint256 ui = IERC20(USDC).balanceOf(address(this));
        uint256 wi = IERC20(WETH).balanceOf(address(this));
        (uint160 sp,,,,,) = POOL.slot0();
        uint256 sv = _wethToUsdc(sw + wi, sp);
        return (sv + ui > du) ? sv + ui - du : 0;
    }

    function _valShort() internal view returns (uint256) {
        uint256 su = IAToken(A_USDC).balanceOf(address(this));
        uint256 dw = IVariableDebtToken(DEBT_WETH).balanceOf(address(this));
        uint256 ui = IERC20(USDC).balanceOf(address(this));
        uint256 wi = IERC20(WETH).balanceOf(address(this));
        (uint160 sp,,,,,) = POOL.slot0();
        uint256 wiv = _wethToUsdc(wi, sp);
        uint256 dv = _wethToUsdc(dw, sp);
        return (su + ui + wiv > dv) ? su + ui + wiv - dv : 0;
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — Helpers
    // ══════════════════════════════════════════════════════════════

    function _getCurrentTick() internal view returns (int24 tick) {
        (, tick,,,,) = POOL.slot0();
    }

    function _swapExact(address tokenIn, address tokenOut, uint256 amountIn)
        internal returns (uint256)
    {
        if (amountIn == 0) return 0;
        int24 ts = (tokenIn == AERO || tokenOut == AERO) ? int24(200) : TICK_SPACING;

        uint256 minOut;
        if (tokenIn == WETH && tokenOut == USDC) {
            (uint160 sp,,,,,) = POOL.slot0();
            minOut = (_wethToUsdc(amountIn, sp) * 98) / 100;
        } else if (tokenIn == USDC && tokenOut == WETH) {
            (uint160 sp,,,,,) = POOL.slot0();
            minOut = (_usdcToWeth(amountIn, sp) * 98) / 100;
        }

        return ROUTER.exactInputSingle(ICLSwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn, tokenOut: tokenOut, tickSpacing: ts,
            recipient: address(this), deadline: block.timestamp,
            amountIn: amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0
        }));
    }

    function _getPositionAmounts() internal view returns (uint256 a0, uint256 a1) {
        if (tokenId == 0) return (0, 0);
        (,,,,,,, uint128 liq,,,,) = NPM.positions(tokenId);
        if (liq == 0) return (0, 0);
        (uint160 sp,,,,,) = POOL.slot0();
        (a0, a1) = LiquidityAmounts.getAmountsForLiquidity(
            sp, TickMath.getSqrtRatioAtTick(tickLower),
            TickMath.getSqrtRatioAtTick(tickUpper), liq
        );
    }

    function _wethToUsdc(uint256 w, uint160 sp) internal pure returns (uint256) {
        if (w == 0) return 0;
        uint256 p = uint256(sp) * uint256(sp);
        return Math.mulDiv(w, p, 1 << 192);
    }

    function _usdcToWeth(uint256 u, uint160 sp) internal pure returns (uint256) {
        if (u == 0) return 0;
        uint256 p = uint256(sp) * uint256(sp);
        return Math.mulDiv(u, 1 << 192, p);
    }

    function _roundToSpacing(int24 tick) internal pure returns (int24) {
        int24 m = tick % TICK_SPACING;
        if (m < 0) m += TICK_SPACING;
        return tick - m;
    }

    // ══════════════════════════════════════════════════════════════
    //  DISABLED ERC-4626 STANDARD FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    error Disabled();

    function deposit(uint256, address) public pure override returns (uint256) { revert Disabled(); }
    function withdraw(uint256, address, address) public pure override returns (uint256) { revert Disabled(); }
    function mint(uint256, address) public pure override returns (uint256) { revert Disabled(); }
    function redeem(uint256, address, address) public pure override returns (uint256) { revert Disabled(); }
}
