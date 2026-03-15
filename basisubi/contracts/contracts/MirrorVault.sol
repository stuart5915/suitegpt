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

/// @title MirrorVault — Mirror an Aerodrome LP Position
/// @notice ERC-4626 vault that deposits USDC and mirrors the tick range of a
///         tracked external Aerodrome CL position. When the tracked position's
///         range changes (rebalance, new position), the keeper calls `mirror()`
///         to re-center this vault's position to match.
///         Depositors earn the same concentrated liquidity yield, proportional
///         to their deposit. No manual range control — the vault ONLY follows.
contract MirrorVault is
    Initializable,
    ERC4626Upgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    // Aerodrome contracts
    INonfungiblePositionManager public positionManager;
    ICLSwapRouter public swapRouter;
    IERC20 public weth;
    address public pool;

    // Vault's own LP position
    uint256 public tokenId;
    int24 public currentTickLower;
    int24 public currentTickUpper;

    // Tracked (leader) position
    address public trackedWallet;
    uint256 public trackedTokenId;
    int24 public trackedTickLower;
    int24 public trackedTickUpper;

    // Config
    uint256 public slippageTolerance;   // bps, e.g. 50 = 0.5%
    uint256 public compoundMinimum;     // min idle USDC to deploy
    uint256 public depositCap;
    uint256 public performanceFeeBps;
    address public feeManager;

    // Admin
    address public admin;
    bool public upgradeRenounced;
    bool public wethIsToken0;

    // Stats
    uint256 public mirrorCount;
    uint256 public lastMirrorTime;
    uint256 public compoundCount;
    uint256 public lastCompoundTime;
    uint256 public totalFeesEarnedUsdc;

    // Reserved
    uint256[40] private __gap;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event Mirrored(
        int24 oldTickLower, int24 oldTickUpper,
        int24 newTickLower, int24 newTickUpper,
        uint256 trackedTokenId
    );
    event Compounded(uint256 feesCollected0, uint256 feesCollected1, uint256 idleDeployed);
    event TrackedPositionUpdated(address indexed wallet, uint256 tokenId);
    event DepositCapUpdated(uint256 newCap);
    event PerformanceFeeUpdated(uint256 newFeeBps);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
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
        address _pool,
        address _admin,
        address _feeManager,
        uint256 _depositCap
    ) external initializer {
        require(_usdc != address(0) && _weth != address(0), "zero token");
        require(_positionManager != address(0) && _swapRouter != address(0), "zero contract");
        require(_pool != address(0), "zero pool");
        require(_admin != address(0), "zero admin");

        __ERC20_init("Basis Mirror Vault", "bmUSDC");
        __ERC4626_init(IERC20(_usdc));
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        weth = IERC20(_weth);
        positionManager = INonfungiblePositionManager(_positionManager);
        swapRouter = ICLSwapRouter(_swapRouter);
        pool = _pool;
        admin = _admin;
        feeManager = _feeManager;
        depositCap = _depositCap;
        slippageTolerance = 100; // 1% default
        compoundMinimum = 1e6;   // $1 USDC
        wethIsToken0 = _weth < _usdc;
    }

    function version() external pure returns (uint256) { return 1; }

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // ══════════════════════════════════════════════════════════════
    //  ERC-4626 OVERRIDES
    // ══════════════════════════════════════════════════════════════

    function totalAssets() public view override returns (uint256) {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        uint256 lpValue = _getLPValueInUsdc();
        return idle + lpValue;
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
        address caller, address receiver, uint256 assets, uint256 shares
    ) internal override nonReentrant whenNotPaused {
        require(totalAssets() + assets <= depositCap, "deposit cap");
        super._deposit(caller, receiver, assets, shares);
    }

    /// @dev Withdrawals never pause. Frees LP if needed.
    function _withdraw(
        address caller, address receiver, address owner,
        uint256 assets, uint256 shares
    ) internal override nonReentrant {
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle < assets) {
            _removeLiquidityForUsdc(assets - idle);
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    // ══════════════════════════════════════════════════════════════
    //  CORE — MIRROR
    // ══════════════════════════════════════════════════════════════

    /// @notice Read the tracked position's tick range and re-center this
    ///         vault's position to match. Permissionless — anyone can call
    ///         when the tracked range has changed.
    function mirror() external nonReentrant {
        require(trackedWallet != address(0), "no tracked wallet");

        // Read leader's current position
        (int24 leaderLower, int24 leaderUpper, bool leaderActive) = _getTrackedRange();
        require(leaderActive, "tracked position empty");

        // Only mirror if range actually changed
        require(
            leaderLower != trackedTickLower || leaderUpper != trackedTickUpper,
            "range unchanged"
        );

        int24 oldLower = currentTickLower;
        int24 oldUpper = currentTickUpper;

        // 1. Exit current position (if any)
        if (tokenId != 0) {
            _removeAllLiquidity();
            (uint256 fees0, uint256 fees1) = _collectAll();
            _takePerformanceFee(fees0, fees1);
            positionManager.burn(tokenId);
            tokenId = 0;

            // Consolidate to USDC
            uint256 wethBal = weth.balanceOf(address(this));
            if (wethBal > 0) {
                _swap(address(weth), asset(), wethBal);
            }
        }

        // 2. Update tracked range
        trackedTickLower = leaderLower;
        trackedTickUpper = leaderUpper;

        // 3. Mint new position at leader's range
        uint256 idle = IERC20(asset()).balanceOf(address(this));
        if (idle > compoundMinimum) {
            _swapAndMint(idle, leaderLower, leaderUpper);
        }

        mirrorCount++;
        lastMirrorTime = block.timestamp;

        emit Mirrored(oldLower, oldUpper, leaderLower, leaderUpper, trackedTokenId);
    }

    /// @notice Deploy idle USDC into the current mirrored range.
    ///         Only works when range is set and position is in range.
    function compound() external nonReentrant {
        require(trackedTickLower != 0 || trackedTickUpper != 0, "no range set");

        uint256 fees0;
        uint256 fees1;

        if (tokenId != 0) {
            require(_isInRange(), "out of range - call mirror()");
            (fees0, fees1) = _collectFees();
            _takePerformanceFee(fees0, fees1);
        }

        uint256 idle = IERC20(asset()).balanceOf(address(this));
        require(idle >= compoundMinimum, "below minimum");

        if (tokenId == 0) {
            _swapAndMint(idle, trackedTickLower, trackedTickUpper);
        } else {
            _addToPosition(idle);
        }

        compoundCount++;
        lastCompoundTime = block.timestamp;

        emit Compounded(fees0, fees1, idle);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — TRACKED POSITION
    // ══════════════════════════════════════════════════════════════

    /// @notice Set the wallet + NFT token ID to mirror.
    ///         Admin can update this to follow a different position.
    function setTrackedPosition(address _wallet, uint256 _tokenId) external onlyAdmin {
        require(_wallet != address(0), "zero wallet");

        // Validate the position exists and is ETH/USDC
        (,,address t0, address t1,,,,uint128 liq,,,,) = positionManager.positions(_tokenId);
        require(liq > 0, "position empty");
        bool validPair = (t0 == address(weth) && t1 == asset()) ||
                         (t0 == asset() && t1 == address(weth));
        require(validPair, "not ETH/USDC position");

        trackedWallet = _wallet;
        trackedTokenId = _tokenId;

        emit TrackedPositionUpdated(_wallet, _tokenId);
    }

    /// @notice Auto-discover the best ETH/USDC position for a wallet.
    ///         Finds the position with the most liquidity.
    function discoverTrackedPosition(address _wallet) external onlyAdmin {
        require(_wallet != address(0), "zero wallet");

        uint256 balance = IERC721Enumerable(address(positionManager)).balanceOf(_wallet);
        require(balance > 0, "no positions");

        uint256 bestId;
        uint128 bestLiq;

        for (uint256 i = 0; i < balance; i++) {
            uint256 tid = IERC721Enumerable(address(positionManager)).tokenOfOwnerByIndex(_wallet, i);
            (,,address t0, address t1,,,,uint128 liq,,,,) = positionManager.positions(tid);
            bool validPair = (t0 == address(weth) && t1 == asset()) ||
                             (t0 == asset() && t1 == address(weth));
            if (validPair && liq > bestLiq) {
                bestLiq = liq;
                bestId = tid;
            }
        }

        require(bestLiq > 0, "no ETH/USDC positions");
        trackedWallet = _wallet;
        trackedTokenId = bestId;

        emit TrackedPositionUpdated(_wallet, bestId);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — CONFIG
    // ══════════════════════════════════════════════════════════════

    function setDepositCap(uint256 newCap) external onlyAdmin {
        depositCap = newCap;
        emit DepositCapUpdated(newCap);
    }

    function setPerformanceFee(uint256 newFeeBps) external onlyAdmin {
        require(newFeeBps <= 3000, "fee > 30%");
        performanceFeeBps = newFeeBps;
        emit PerformanceFeeUpdated(newFeeBps);
    }

    function setSlippage(uint256 newBps) external onlyAdmin {
        require(newBps <= 1000, "slippage > 10%");
        slippageTolerance = newBps;
    }

    function setCompoundMinimum(uint256 newMin) external onlyAdmin {
        compoundMinimum = newMin;
    }

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function emergencyExitLP() external onlyAdmin {
        if (tokenId == 0) return;
        _removeAllLiquidity();
        _collectAll();
        positionManager.burn(tokenId);
        tokenId = 0;

        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) {
            _swap(address(weth), asset(), wethBal);
        }
        emit EmergencyExitLP(IERC20(asset()).balanceOf(address(this)));
    }

    function recoverToken(address token) external onlyAdmin {
        require(token != asset() && token != address(weth), "protected");
        IERC20(token).safeTransfer(admin, IERC20(token).balanceOf(address(this)));
    }

    // ══════════════════════════════════════════════════════════════
    //  UUPS
    // ══════════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal view override {
        require(msg.sender == admin && !upgradeRenounced, "unauthorized");
    }

    function renounceUpgradeability() external onlyAdmin {
        upgradeRenounced = true;
    }

    // ══════════════════════════════════════════════════════════════
    //  PUBLIC VIEWS
    // ══════════════════════════════════════════════════════════════

    function isInRange() public view returns (bool) {
        if (tokenId == 0) return false;
        return _isInRange();
    }

    /// @notice Check if the tracked position's range differs from ours.
    function needsMirror() external view returns (bool) {
        if (trackedWallet == address(0)) return false;
        (int24 leaderLower, int24 leaderUpper, bool active) = _getTrackedRange();
        if (!active) return false;
        return leaderLower != trackedTickLower || leaderUpper != trackedTickUpper;
    }

    function getVaultInfo() external view returns (
        uint256 _totalAssets,
        uint256 _totalSupply,
        int24 _tickLower,
        int24 _tickUpper,
        int24 _trackedTickLower,
        int24 _trackedTickUpper,
        bool _inRange,
        bool _needsMirror,
        address _trackedWallet,
        uint256 _trackedTokenId,
        uint256 _mirrorCount,
        uint256 _depositCap,
        uint256 _performanceFeeBps,
        bool _paused
    ) {
        _totalAssets = totalAssets();
        _totalSupply = totalSupply();
        _tickLower = currentTickLower;
        _tickUpper = currentTickUpper;
        _trackedTickLower = trackedTickLower;
        _trackedTickUpper = trackedTickUpper;
        _inRange = tokenId != 0 ? _isInRange() : false;
        _trackedWallet = trackedWallet;
        _trackedTokenId = trackedTokenId;
        _mirrorCount = mirrorCount;
        _depositCap = depositCap;
        _performanceFeeBps = performanceFeeBps;
        _paused = paused();

        // Check if mirror needed
        if (trackedWallet != address(0)) {
            (int24 ll, int24 lu, bool active) = _getTrackedRange();
            _needsMirror = active && (ll != trackedTickLower || lu != trackedTickUpper);
        }
    }

    function getUserPosition(address user) external view returns (uint256 shares, uint256 value) {
        shares = balanceOf(user);
        uint256 supply = totalSupply();
        if (supply > 0) {
            value = (shares * totalAssets()) / supply;
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — TRACKED POSITION
    // ══════════════════════════════════════════════════════════════

    /// @dev Read the leader's position ticks from the Position Manager.
    function _getTrackedRange() internal view returns (int24 tickLower, int24 tickUpper, bool active) {
        if (trackedTokenId == 0) return (0, 0, false);
        (,,,,,int24 tl, int24 tu, uint128 liq,,,,) = positionManager.positions(trackedTokenId);
        return (tl, tu, liq > 0);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — LP OPERATIONS (adapted from BasisVault)
    // ══════════════════════════════════════════════════════════════

    function _getLPValueInUsdc() internal view returns (uint256) {
        if (tokenId == 0) return 0;
        (,,,,,,, uint128 liquidity,,, uint128 tokensOwed0, uint128 tokensOwed1)
            = positionManager.positions(tokenId);
        if (liquidity == 0 && tokensOwed0 == 0 && tokensOwed1 == 0) return 0;

        (uint160 sqrtPriceX96,,,,,) = ICLPool(pool).slot0();
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(currentTickLower);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(currentTickUpper);
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

    function _wethToUsdc(uint256 wethAmount, uint160 sqrtPriceX96) internal view returns (uint256) {
        if (wethAmount == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        if (wethIsToken0) {
            return Math.mulDiv(wethAmount, priceX192, 1 << 192);
        } else {
            return Math.mulDiv(wethAmount, 1 << 192, priceX192);
        }
    }

    function _isInRange() internal view returns (bool) {
        (, int24 currentTick,,,,) = ICLPool(pool).slot0();
        return currentTick >= currentTickLower && currentTick < currentTickUpper;
    }

    function _swapAndMint(uint256 usdcAmount, int24 tl, int24 tu) internal {
        int24 ts = ICLPool(pool).tickSpacing();
        // Snap ticks to spacing
        tl = _roundDownToSpacing(tl, ts);
        tu = _roundUpToSpacing(tu, ts);

        uint256 usdcToSwap = _calculateSwapAmount(usdcAmount, tl, tu);
        uint256 wethAmt = usdcToSwap > 0 ? _swap(asset(), address(weth), usdcToSwap) : 0;
        uint256 usdcAmt = IERC20(asset()).balanceOf(address(this));

        (uint256 a0, uint256 a1) = wethIsToken0 ? (wethAmt, usdcAmt) : (usdcAmt, wethAmt);
        address t0 = wethIsToken0 ? address(weth) : asset();
        address t1 = wethIsToken0 ? asset() : address(weth);
        IERC20(t0).forceApprove(address(positionManager), a0);
        IERC20(t1).forceApprove(address(positionManager), a1);

        (uint256 newId,,,) = positionManager.mint(
            INonfungiblePositionManager.MintParams({
                token0: t0, token1: t1, tickSpacing: ts,
                tickLower: tl, tickUpper: tu,
                amount0Desired: a0, amount1Desired: a1,
                amount0Min: a0 * (10000 - slippageTolerance) / 10000,
                amount1Min: a1 * (10000 - slippageTolerance) / 10000,
                recipient: address(this),
                deadline: block.timestamp,
                sqrtPriceX96: 0
            })
        );

        tokenId = newId;
        currentTickLower = tl;
        currentTickUpper = tu;
        IERC20(t0).forceApprove(address(positionManager), 0);
        IERC20(t1).forceApprove(address(positionManager), 0);
    }

    function _addToPosition(uint256 usdcAmount) internal {
        uint256 usdcToSwap = _calculateSwapAmount(usdcAmount, currentTickLower, currentTickUpper);
        uint256 wethAmount = usdcToSwap > 0 ? _swap(asset(), address(weth), usdcToSwap) : 0;
        uint256 usdcRemaining = IERC20(asset()).balanceOf(address(this));

        (uint256 a0, uint256 a1) = wethIsToken0
            ? (wethAmount, usdcRemaining) : (usdcRemaining, wethAmount);
        address t0 = wethIsToken0 ? address(weth) : asset();
        address t1 = wethIsToken0 ? asset() : address(weth);
        IERC20(t0).forceApprove(address(positionManager), a0);
        IERC20(t1).forceApprove(address(positionManager), a1);

        positionManager.increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: tokenId,
                amount0Desired: a0, amount1Desired: a1,
                amount0Min: a0 * (10000 - slippageTolerance) / 10000,
                amount1Min: a1 * (10000 - slippageTolerance) / 10000,
                deadline: block.timestamp
            })
        );
        IERC20(t0).forceApprove(address(positionManager), 0);
        IERC20(t1).forceApprove(address(positionManager), 0);
    }

    function _removeLiquidityForUsdc(uint256 usdcNeeded) internal {
        if (tokenId == 0) return;
        uint256 lpValue = _getLPValueInUsdc();
        if (lpValue == 0) return;
        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(tokenId);
        uint256 fraction = Math.min((usdcNeeded * 10200 * 1e18) / (lpValue * 10000), 1e18);
        uint128 toRemove = uint128(uint256(liquidity) * fraction / 1e18);
        if (toRemove == 0) toRemove = 1;

        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, liquidity: toRemove,
                amount0Min: 0, amount1Min: 0, deadline: block.timestamp
            })
        );
        positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId, recipient: address(this),
                amount0Max: type(uint128).max, amount1Max: type(uint128).max
            })
        );
        uint256 wethBal = weth.balanceOf(address(this));
        if (wethBal > 0) _swap(address(weth), asset(), wethBal);

        (,,,,,,, uint128 remaining,,,,) = positionManager.positions(tokenId);
        if (remaining == 0) { positionManager.burn(tokenId); tokenId = 0; }
    }

    function _removeAllLiquidity() internal {
        (,,,,,,, uint128 liquidity,,,,) = positionManager.positions(tokenId);
        if (liquidity == 0) return;
        positionManager.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId, liquidity: liquidity,
                amount0Min: 0, amount1Min: 0, deadline: block.timestamp
            })
        );
    }

    function _collectFees() internal returns (uint256 a0, uint256 a1) {
        (a0, a1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId, recipient: address(this),
                amount0Max: type(uint128).max, amount1Max: type(uint128).max
            })
        );
    }

    function _collectAll() internal returns (uint256 a0, uint256 a1) {
        return _collectFees();
    }

    function _takePerformanceFee(uint256 fees0, uint256 fees1) internal {
        if (performanceFeeBps == 0 || feeManager == address(0)) return;
        uint256 wethFees = wethIsToken0 ? fees0 : fees1;
        uint256 usdcFees = wethIsToken0 ? fees1 : fees0;
        if (wethFees > 0) usdcFees += _swap(address(weth), asset(), wethFees);
        totalFeesEarnedUsdc += usdcFees;
        uint256 fee = (usdcFees * performanceFeeBps) / 10000;
        if (fee > 0) IERC20(asset()).safeTransfer(feeManager, fee);
    }

    function _swap(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256) {
        if (amountIn == 0) return 0;
        IERC20(tokenIn).forceApprove(address(swapRouter), amountIn);
        int24 tickSpacing = ICLPool(pool).tickSpacing();
        (uint160 sqrtPriceX96,,,,,) = ICLPool(pool).slot0();
        uint256 expected = _getExpectedOutput(tokenIn, amountIn, sqrtPriceX96);
        uint256 minOut = expected * (10000 - slippageTolerance) / 10000;

        uint256 out = swapRouter.exactInputSingle(
            ICLSwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn, tokenOut: tokenOut, tickSpacing: tickSpacing,
                recipient: address(this), deadline: block.timestamp,
                amountIn: amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0
            })
        );
        IERC20(tokenIn).forceApprove(address(swapRouter), 0);
        return out;
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

    function _calculateSwapAmount(uint256 totalUsdc, int24 tickLower, int24 tickUpper)
        internal view returns (uint256)
    {
        (, int24 currentTick,,,,) = ICLPool(pool).slot0();
        if (currentTick <= tickLower) return totalUsdc;
        if (currentTick >= tickUpper) return 0;
        uint160 sqrtPrice = TickMath.getSqrtRatioAtTick(currentTick);
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(tickUpper);
        uint256 num = uint256(sqrtPrice) * uint256(sqrtB - sqrtPrice);
        uint256 den = num + uint256(sqrtPrice - sqrtA) * uint256(sqrtB);
        return (totalUsdc * num) / den;
    }

    function _roundDownToSpacing(int24 tick, int24 ts) internal pure returns (int24) {
        int24 mod = tick % ts;
        if (mod < 0) mod += ts;
        return tick - mod;
    }

    function _roundUpToSpacing(int24 tick, int24 ts) internal pure returns (int24) {
        int24 r = _roundDownToSpacing(tick, ts);
        if (r < tick) r += ts;
        return r;
    }
}

/// @dev Minimal ERC721Enumerable interface for position discovery.
interface IERC721Enumerable {
    function balanceOf(address owner) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}
