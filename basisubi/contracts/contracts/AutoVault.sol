// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./interfaces/IAerodromeCL.sol";
import "./libraries/TickMath.sol";
import "./libraries/LiquidityAmounts.sol";

/// @title AutoVault — Permissionless Aerodrome CL Vault (ETH/USDC)
/// @notice ERC-4626 vault that manages a single concentrated liquidity position
///         on Aerodrome's ETH/USDC pool. Fully permissionless — no admin, no owner,
///         no pausing, no upgrades. Deposits USDC + WETH, earns trading fees + AERO
///         rewards. AERO is compounded into WETH and held as ethReserve until deployed.
contract AutoVault is ERC4626, ReentrancyGuard, IERC721Receiver {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  CONSTANTS — Base Mainnet Addresses
    // ══════════════════════════════════════════════════════════════

    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant AERO = 0x940181a94A35A4569E4529A3CDfB74e38FD98631;

    INonfungiblePositionManager public constant NPM =
        INonfungiblePositionManager(0x827922686190790b37229fd06084350E74485b72);
    ICLSwapRouter public constant ROUTER =
        ICLSwapRouter(0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5);
    ICLPool public constant POOL =
        ICLPool(0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59);
    ICLGauge public constant GAUGE =
        ICLGauge(0xF33a96b5932D9E9B9A0eDA447AbD8C9d48d2e0c8);

    // WETH (0x4200..0006) < USDC (0x8335..2913), so WETH is token0
    // sqrtPriceX96 from slot0 gives: price = (sqrtPriceX96 / 2^96)^2
    // This price is in token1/token0 = USDC/WETH (with decimal adjustment)

    int24 public constant TICK_SPACING = 100;

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    /// @notice NFT ID of the current Aerodrome CL position (0 = no position)
    uint256 public tokenId;

    /// @notice Current position range lower tick
    int24 public tickLower;

    /// @notice Current position range upper tick
    int24 public tickUpper;

    /// @notice WETH accumulated from AERO compounding, waiting to be deployed
    uint256 public ethReserve;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event Deposited(address indexed user, uint256 usdcAmount, uint256 ethAmount, uint256 shares);
    event Withdrawn(address indexed user, uint256 shares, uint256 wethOut, uint256 usdcOut);
    event Rebalanced(int24 oldTickLower, int24 oldTickUpper, int24 newTickLower, int24 newTickUpper);
    event Compounded(uint256 aeroSwapped, uint256 wethReceived);

    // ══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    constructor()
        ERC20("Basis AutoVault", "bvUSDC")
        ERC4626(IERC20(USDC))
    {
        // Max-approve tokens to router and position manager
        IERC20(USDC).forceApprove(address(ROUTER), type(uint256).max);
        IERC20(USDC).forceApprove(address(NPM), type(uint256).max);
        IERC20(WETH).forceApprove(address(ROUTER), type(uint256).max);
        IERC20(WETH).forceApprove(address(NPM), type(uint256).max);
        IERC20(AERO).forceApprove(address(ROUTER), type(uint256).max);
    }

    // ══════════════════════════════════════════════════════════════
    //  ERC-721 RECEIVER (for Aerodrome position NFTs)
    // ══════════════════════════════════════════════════════════════

    function onERC721Received(address, address, uint256, bytes calldata)
        external pure override returns (bytes4)
    {
        return this.onERC721Received.selector;
    }

    // ══════════════════════════════════════════════════════════════
    //  DEPOSIT — Custom dual-asset deposit
    // ══════════════════════════════════════════════════════════════

    /// @notice Deposit USDC and/or WETH into the vault.
    ///         User must approve both tokens to this contract first.
    /// @param usdcAmount Amount of USDC to deposit (6 decimals)
    /// @param ethAmount  Amount of WETH to deposit (18 decimals)
    /// @return shares Number of vault shares minted
    function deposit(uint256 usdcAmount, uint256 ethAmount)
        external
        nonReentrant
        returns (uint256 shares)
    {
        require(usdcAmount > 0 || ethAmount > 0, "AutoVault: zero deposit");

        // Snapshot total value before deposit for share calculation
        uint256 totalBefore = totalAssets();
        uint256 supplyBefore = totalSupply();

        // Transfer tokens from user
        if (usdcAmount > 0) {
            IERC20(USDC).safeTransferFrom(msg.sender, address(this), usdcAmount);
        }
        if (ethAmount > 0) {
            IERC20(WETH).safeTransferFrom(msg.sender, address(this), ethAmount);
        }

        if (tokenId == 0) {
            // ── No existing position: create one ──

            // If user sent only USDC, swap 50% to WETH
            if (ethAmount == 0) {
                uint256 halfUsdc = usdcAmount / 2;
                ethAmount = _swapExact(USDC, WETH, halfUsdc);
                usdcAmount = IERC20(USDC).balanceOf(address(this));
            }
            // If user sent only WETH, swap 50% to USDC
            if (usdcAmount == 0) {
                uint256 halfEth = ethAmount / 2;
                usdcAmount = _swapExact(WETH, USDC, halfEth);
                ethAmount = IERC20(WETH).balanceOf(address(this));
            }

            // Calculate ±10% range from current tick
            int24 currentTick = _getCurrentTick();
            int24 tl = _roundToSpacing(currentTick - 953); // ~-10%
            int24 tu = _roundToSpacing(currentTick + 953); // ~+10%
            // Ensure we get valid range (lower < upper)
            if (tl >= tu) tu = tl + TICK_SPACING;

            // Mint new position
            // token0 = WETH, token1 = USDC
            (uint256 newTokenId,,,) = NPM.mint(
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: USDC,
                    tickSpacing: TICK_SPACING,
                    tickLower: tl,
                    tickUpper: tu,
                    amount0Desired: ethAmount,
                    amount1Desired: usdcAmount,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    sqrtPriceX96: 0
                })
            );

            tokenId = newTokenId;
            tickLower = tl;
            tickUpper = tu;

            // Stake in gauge
            NPM.approve(address(GAUGE), tokenId);
            GAUGE.deposit(tokenId);

        } else {
            // ── Existing position: add liquidity ──

            // Determine current position's asset ratio based on tick vs range
            (uint256 posWeth, uint256 posUsdc) = _getPositionAmounts();

            // Include ethReserve in the WETH pool
            uint256 totalWeth = ethAmount + ethReserve;
            uint256 totalUsdc = usdcAmount;

            // Calculate target ratio from current position
            // If position has both tokens, match that ratio
            if (posWeth > 0 && posUsdc > 0) {
                // Target ratio: posWeth/posUsdc
                // User has totalWeth and totalUsdc
                // Calculate how much to swap to match ratio

                // Convert WETH to USDC-equivalent for ratio comparison
                (uint160 sqrtPriceX96,,,,,) = POOL.slot0();
                uint256 wethValueInUsdc = _wethToUsdc(totalWeth, sqrtPriceX96);
                uint256 totalValueUsdc = wethValueInUsdc + totalUsdc;

                // Position ratio tells us what fraction should be WETH
                uint256 posWethValue = _wethToUsdc(posWeth, sqrtPriceX96);
                uint256 posTotalValue = posWethValue + posUsdc;

                // Target WETH fraction (scaled by 1e18)
                uint256 targetWethFrac = (posWethValue * 1e18) / posTotalValue;
                uint256 currentWethFrac = (wethValueInUsdc * 1e18) / totalValueUsdc;

                if (currentWethFrac > targetWethFrac + 1e16) {
                    // Too much WETH, swap some to USDC
                    uint256 excessWethValue = ((currentWethFrac - targetWethFrac) * totalValueUsdc) / 1e18;
                    uint256 wethToSwap = _usdcToWeth(excessWethValue, sqrtPriceX96);
                    if (wethToSwap > 0 && wethToSwap <= totalWeth) {
                        _swapExact(WETH, USDC, wethToSwap);
                    }
                } else if (currentWethFrac + 1e16 < targetWethFrac) {
                    // Too much USDC, swap some to WETH
                    uint256 excessUsdc = ((targetWethFrac - currentWethFrac) * totalValueUsdc) / 1e18;
                    if (excessUsdc > 0 && excessUsdc <= totalUsdc) {
                        _swapExact(USDC, WETH, excessUsdc);
                    }
                }
            } else if (posWeth == 0 && posUsdc > 0) {
                // Position is entirely USDC (above range) — swap WETH to USDC
                if (totalWeth > 0) {
                    _swapExact(WETH, USDC, totalWeth);
                }
            } else if (posWeth > 0 && posUsdc == 0) {
                // Position is entirely WETH (below range) — swap USDC to WETH
                if (totalUsdc > 0) {
                    _swapExact(USDC, WETH, totalUsdc);
                }
            }

            // Reset ethReserve since we used it
            ethReserve = 0;

            // Get final balances to deposit
            uint256 wethBal = IERC20(WETH).balanceOf(address(this));
            uint256 usdcBal = IERC20(USDC).balanceOf(address(this));

            // Unstake from gauge to increase liquidity
            GAUGE.withdraw(tokenId);

            if (wethBal > 0 || usdcBal > 0) {
                NPM.increaseLiquidity(
                    INonfungiblePositionManager.IncreaseLiquidityParams({
                        tokenId: tokenId,
                        amount0Desired: wethBal,  // token0 = WETH
                        amount1Desired: usdcBal,  // token1 = USDC
                        amount0Min: 0,
                        amount1Min: 0,
                        deadline: block.timestamp
                    })
                );
            }

            // Restake in gauge
            NPM.approve(address(GAUGE), tokenId);
            GAUGE.deposit(tokenId);
        }

        // Calculate shares to mint
        uint256 depositValue = _totalVaultValue() - totalBefore;
        if (supplyBefore == 0) {
            shares = depositValue;
        } else {
            shares = (depositValue * supplyBefore) / totalBefore;
        }
        require(shares > 0, "AutoVault: zero shares");

        _mint(msg.sender, shares);

        emit Deposited(msg.sender, usdcAmount, ethAmount, shares);
    }

    // ══════════════════════════════════════════════════════════════
    //  WITHDRAW — Custom proportional withdrawal
    // ══════════════════════════════════════════════════════════════

    /// @notice Withdraw proportional share of vault assets.
    /// @param shares Number of vault shares to burn
    function withdraw(uint256 shares) external nonReentrant {
        require(shares > 0, "AutoVault: zero shares");
        require(balanceOf(msg.sender) >= shares, "AutoVault: insufficient shares");

        uint256 supply = totalSupply();
        // User's proportion (scaled by 1e18)
        uint256 proportion = (shares * 1e18) / supply;

        // Unstake from gauge
        if (tokenId != 0) {
            GAUGE.withdraw(tokenId);
        }

        // Get position liquidity and decrease by proportion
        uint256 wethOut;
        uint256 usdcOut;

        if (tokenId != 0) {
            (,,,,,,, uint128 liquidity,,,,) = NPM.positions(tokenId);

            if (liquidity > 0) {
                uint128 liquidityToRemove = uint128((uint256(liquidity) * proportion) / 1e18);

                if (liquidityToRemove > 0) {
                    NPM.decreaseLiquidity(
                        INonfungiblePositionManager.DecreaseLiquidityParams({
                            tokenId: tokenId,
                            liquidity: liquidityToRemove,
                            amount0Min: 0,
                            amount1Min: 0,
                            deadline: block.timestamp
                        })
                    );
                }
            }

            // Collect tokens + fees
            (uint256 collected0, uint256 collected1) = NPM.collect(
                INonfungiblePositionManager.CollectParams({
                    tokenId: tokenId,
                    recipient: address(this),
                    amount0Max: type(uint128).max,
                    amount1Max: type(uint128).max
                })
            );

            // collected0 = WETH, collected1 = USDC
            // Only send proportional share of collected (fees may exceed proportion)
            wethOut = (collected0 * proportion) / 1e18;
            usdcOut = (collected1 * proportion) / 1e18;

            // Re-deposit any excess collected back (from fees belonging to remaining LPs)
            uint256 excessWeth = collected0 - wethOut;
            uint256 excessUsdc = collected1 - usdcOut;

            // Check remaining liquidity
            (,,,,,,, uint128 remainingLiq,,,,) = NPM.positions(tokenId);

            if (remainingLiq > 0) {
                // Increase liquidity with excess tokens if any
                if (excessWeth > 0 || excessUsdc > 0) {
                    NPM.increaseLiquidity(
                        INonfungiblePositionManager.IncreaseLiquidityParams({
                            tokenId: tokenId,
                            amount0Desired: excessWeth,
                            amount1Desired: excessUsdc,
                            amount0Min: 0,
                            amount1Min: 0,
                            deadline: block.timestamp
                        })
                    );
                }

                // Restake remaining position in gauge
                NPM.approve(address(GAUGE), tokenId);
                GAUGE.deposit(tokenId);
            } else {
                // Position fully drained — burn NFT
                NPM.burn(tokenId);
                tokenId = 0;
                tickLower = 0;
                tickUpper = 0;

                // Send all excess directly to user since no position remains
                wethOut += excessWeth;
                usdcOut += excessUsdc;
            }
        }

        // Proportional share of ethReserve (as WETH)
        uint256 reserveOut = (ethReserve * proportion) / 1e18;
        if (reserveOut > 0) {
            ethReserve -= reserveOut;
            wethOut += reserveOut;
        }

        // Burn shares
        _burn(msg.sender, shares);

        // Transfer tokens to user
        if (wethOut > 0) {
            IERC20(WETH).safeTransfer(msg.sender, wethOut);
        }
        if (usdcOut > 0) {
            IERC20(USDC).safeTransfer(msg.sender, usdcOut);
        }

        emit Withdrawn(msg.sender, shares, wethOut, usdcOut);
    }

    // ══════════════════════════════════════════════════════════════
    //  REBALANCE — Permissionless
    // ══════════════════════════════════════════════════════════════

    /// @notice Rebalance the position when price moves out of range.
    ///         Permissionless — anyone can call when out of range.
    function rebalance() external nonReentrant {
        require(tokenId != 0, "AutoVault: no position");

        int24 currentTick = _getCurrentTick();
        require(
            currentTick < tickLower || currentTick >= tickUpper,
            "AutoVault: in range"
        );

        int24 oldTickLower = tickLower;
        int24 oldTickUpper = tickUpper;

        // Unstake from gauge
        GAUGE.withdraw(tokenId);

        // Remove ALL liquidity
        (,,,,,,, uint128 liquidity,,,,) = NPM.positions(tokenId);
        if (liquidity > 0) {
            NPM.decreaseLiquidity(
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: tokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp
                })
            );
        }

        // Collect all tokens + fees
        NPM.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );

        // Claim AERO from gauge — getReward was already triggered by withdraw above,
        // so just check the balance
        uint256 aeroNew = IERC20(AERO).balanceOf(address(this));
        if (aeroNew > 0) {
            uint256 wethFromAero = _swapExact(AERO, WETH, aeroNew);
            ethReserve += wethFromAero;
        }

        // Burn old NFT
        NPM.burn(tokenId);

        // Get current balances
        uint256 wethBal = IERC20(WETH).balanceOf(address(this)) - ethReserve;
        uint256 usdcBal = IERC20(USDC).balanceOf(address(this));

        int24 newTickLower;
        int24 newTickUpper;

        if (currentTick >= oldTickUpper) {
            // ── Price pushed ABOVE range → we're holding USDC ──
            // New range: 80% of current price to current price
            // Approximately: currentTick - 2231 to currentTick (ln(0.80)/ln(1.0001) ≈ -2231)
            newTickLower = _roundToSpacing(currentTick - 2231);
            newTickUpper = _roundToSpacing(currentTick);
            // Ensure range is below current tick for single-sided USDC deposit
            if (newTickUpper >= currentTick) {
                newTickUpper = _roundToSpacing(currentTick - 1);
            }
            if (newTickLower >= newTickUpper) {
                newTickLower = newTickUpper - TICK_SPACING;
            }

            // Mint single-sided USDC position (token1 = USDC)
            (uint256 newId,,,) = NPM.mint(
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: USDC,
                    tickSpacing: TICK_SPACING,
                    tickLower: newTickLower,
                    tickUpper: newTickUpper,
                    amount0Desired: 0,       // No WETH — single-sided USDC
                    amount1Desired: usdcBal,
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    sqrtPriceX96: 0
                })
            );

            tokenId = newId;
            // ethReserve stays untouched — WETH from old position just stays in ethReserve
            ethReserve += wethBal;

        } else {
            // ── Price pushed BELOW range → we're holding ETH ──
            // New range: current price to 120% of current price
            // Approximately: currentTick to currentTick + 1823 (ln(1.20)/ln(1.0001) ≈ 1823)
            newTickLower = _roundToSpacing(currentTick);
            newTickUpper = _roundToSpacing(currentTick + 1823);
            // Ensure range is above current tick for single-sided WETH deposit
            if (newTickLower <= currentTick) {
                newTickLower = _roundToSpacing(currentTick + 1);
            }
            if (newTickUpper <= newTickLower) {
                newTickUpper = newTickLower + TICK_SPACING;
            }

            // Deploy ALL WETH including ethReserve
            uint256 totalWeth = wethBal + ethReserve;
            ethReserve = 0;

            // Mint single-sided WETH position (token0 = WETH)
            (uint256 newId,,,) = NPM.mint(
                INonfungiblePositionManager.MintParams({
                    token0: WETH,
                    token1: USDC,
                    tickSpacing: TICK_SPACING,
                    tickLower: newTickLower,
                    tickUpper: newTickUpper,
                    amount0Desired: totalWeth, // All WETH
                    amount1Desired: 0,          // No USDC — single-sided WETH
                    amount0Min: 0,
                    amount1Min: 0,
                    recipient: address(this),
                    deadline: block.timestamp,
                    sqrtPriceX96: 0
                })
            );

            tokenId = newId;

            // If any USDC remained (shouldn't normally), just leave it in contract
        }

        tickLower = newTickLower;
        tickUpper = newTickUpper;

        // Stake new position in gauge
        NPM.approve(address(GAUGE), tokenId);
        GAUGE.deposit(tokenId);

        emit Rebalanced(oldTickLower, oldTickUpper, newTickLower, newTickUpper);
    }

    // ══════════════════════════════════════════════════════════════
    //  COMPOUND — Permissionless
    // ══════════════════════════════════════════════════════════════

    /// @notice Claim AERO rewards from gauge and swap to WETH.
    ///         Anyone can call this — gas costs are the only barrier.
    function compound() external nonReentrant {
        require(tokenId != 0, "AutoVault: no position");

        // Claim AERO rewards from gauge
        GAUGE.getReward(tokenId);

        uint256 aeroBal = IERC20(AERO).balanceOf(address(this));
        require(aeroBal > 0, "AutoVault: no AERO to compound");

        // Swap AERO → WETH
        uint256 wethReceived = _swapExact(AERO, WETH, aeroBal);

        // Add to ethReserve
        ethReserve += wethReceived;

        emit Compounded(aeroBal, wethReceived);
    }

    // ══════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    /// @notice Total vault value denominated in USDC (the asset).
    ///         Includes: USDC in LP + USDC held + (WETH in LP + WETH held + ethReserve) * price
    function totalAssets() public view override returns (uint256) {
        return _totalVaultValue();
    }

    /// @notice Whether the current position is in range.
    function isInRange() public view returns (bool) {
        if (tokenId == 0) return false;
        int24 currentTick = _getCurrentTick();
        return currentTick >= tickLower && currentTick < tickUpper;
    }

    /// @notice All key vault data in a single RPC call.
    function getVaultInfo() external view returns (
        uint256 totalValue,
        uint256 ethHeld,
        uint256 usdcHeld,
        uint256 _ethReserve,
        uint256 rangeLowPrice,
        uint256 rangeHighPrice,
        bool inRange,
        uint256 _tokenId
    ) {
        totalValue = _totalVaultValue();
        ethHeld = IERC20(WETH).balanceOf(address(this));
        usdcHeld = IERC20(USDC).balanceOf(address(this));
        _ethReserve = ethReserve;
        rangeLowPrice = tickLower != 0 ? _tickToPrice(tickLower) : 0;
        rangeHighPrice = tickUpper != 0 ? _tickToPrice(tickUpper) : 0;
        inRange = isInRange();
        _tokenId = tokenId;
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL — Helpers
    // ══════════════════════════════════════════════════════════════

    /// @dev Read current tick from pool's slot0.
    function _getCurrentTick() internal view returns (int24 tick) {
        (, tick,,,,) = POOL.slot0();
    }

    /// @dev Convert tick to a human-readable price (USDC per ETH, 6 decimal precision).
    ///      price = 1.0001^tick * 10^12 (adjusting for 18-6 decimal difference)
    ///      We use sqrtPrice to avoid large exponentials.
    function _tickToPrice(int24 tick) internal pure returns (uint256 price) {
        uint160 sqrtPriceX96 = TickMath.getSqrtRatioAtTick(tick);
        // price = (sqrtPriceX96 / 2^96)^2 * 10^12
        // = sqrtPriceX96^2 * 10^12 / 2^192
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        // Multiply by 10^12 to adjust for decimal difference (WETH 18 - USDC 6 = 12)
        price = Math.mulDiv(priceX192, 1e12, 1 << 192);
    }

    /// @dev Convert price (USDC per ETH, 6 decimals) to nearest valid tick.
    function _priceToTick(uint256 price) internal pure returns (int24 tick) {
        // Reverse of _tickToPrice: sqrtPriceX96 = sqrt(price * 2^192 / 10^12)
        // This is an approximation — we just use the current tick from the pool
        // for most operations, so this is mainly for reference.
        uint256 priceX192 = Math.mulDiv(price, 1 << 192, 1e12);
        uint160 sqrtPriceX96 = uint160(Math.sqrt(priceX192));
        // Convert sqrtPriceX96 to tick using TickMath (binary search approximation)
        tick = _sqrtPriceToTick(sqrtPriceX96);
        tick = _roundToSpacing(tick);
    }

    /// @dev Approximate tick from sqrtPriceX96 using TickMath boundaries.
    ///      Uses binary search between MIN_TICK and MAX_TICK.
    function _sqrtPriceToTick(uint160 sqrtPriceX96) internal pure returns (int24) {
        require(sqrtPriceX96 >= TickMath.MIN_SQRT_RATIO && sqrtPriceX96 < TickMath.MAX_SQRT_RATIO, "sqrt price out of bounds");

        int24 lo = TickMath.MIN_TICK;
        int24 hi = TickMath.MAX_TICK;

        while (hi - lo > 1) {
            int24 mid = (lo + hi) / 2;
            if (TickMath.getSqrtRatioAtTick(mid) <= sqrtPriceX96) {
                lo = mid;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /// @dev Swap exact input via Aerodrome router. Returns amount received.
    function _swapExact(address tokenIn, address tokenOut, uint256 amountIn)
        internal
        returns (uint256 amountOut)
    {
        if (amountIn == 0) return 0;

        // Determine tick spacing for the route
        // AERO swaps go through AERO/WETH pool (tick spacing 200)
        // ETH/USDC swaps go through our pool (tick spacing 100)
        int24 ts = (tokenIn == AERO || tokenOut == AERO) ? int24(200) : TICK_SPACING;

        amountOut = ROUTER.exactInputSingle(
            ICLSwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                tickSpacing: ts,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: 0, // v1: no slippage protection for simplicity
                sqrtPriceLimitX96: 0
            })
        );
    }

    /// @dev Get current WETH and USDC amounts in the LP position.
    function _getPositionAmounts() internal view returns (uint256 amount0, uint256 amount1) {
        if (tokenId == 0) return (0, 0);

        (,,,,,,, uint128 liquidity,,,,) = NPM.positions(tokenId);
        if (liquidity == 0) return (0, 0);

        (uint160 sqrtPriceX96,,,,,) = POOL.slot0();
        uint160 sqrtA = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtB = TickMath.getSqrtRatioAtTick(tickUpper);

        (amount0, amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96, sqrtA, sqrtB, liquidity
        );
        // amount0 = WETH (token0), amount1 = USDC (token1)
    }

    /// @dev Total vault value in USDC terms.
    function _totalVaultValue() internal view returns (uint256) {
        // 1. Idle balances
        uint256 usdcIdle = IERC20(USDC).balanceOf(address(this));
        uint256 wethIdle = IERC20(WETH).balanceOf(address(this));

        // 2. LP position value
        (uint256 lpWeth, uint256 lpUsdc) = _getPositionAmounts();

        // 3. ethReserve
        uint256 totalWeth = wethIdle + lpWeth + ethReserve;

        // 4. Convert WETH to USDC
        if (totalWeth > 0) {
            (uint160 sqrtPriceX96,,,,,) = POOL.slot0();
            return usdcIdle + lpUsdc + _wethToUsdc(totalWeth, sqrtPriceX96);
        }
        return usdcIdle + lpUsdc;
    }

    /// @dev Convert WETH amount to USDC value using sqrtPriceX96.
    ///      price (token1/token0) = (sqrtPriceX96 / 2^96)^2
    ///      USDC = WETH * price * 10^12 (adjusting decimals: 10^6 / 10^18 * 10^(18+18-96*2) )
    function _wethToUsdc(uint256 wethAmount, uint160 sqrtPriceX96) internal pure returns (uint256) {
        if (wethAmount == 0) return 0;
        // price = sqrtPriceX96^2 / 2^192 = USDC_raw / WETH_raw
        // USDC = WETH * sqrtPriceX96^2 / 2^192
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        return Math.mulDiv(wethAmount, priceX192, 1 << 192);
    }

    /// @dev Convert USDC amount to WETH value using sqrtPriceX96.
    function _usdcToWeth(uint256 usdcAmount, uint160 sqrtPriceX96) internal pure returns (uint256) {
        if (usdcAmount == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        return Math.mulDiv(usdcAmount, 1 << 192, priceX192);
    }

    /// @dev Round tick to nearest multiple of TICK_SPACING (rounds down for negative, down for positive).
    function _roundToSpacing(int24 tick) internal pure returns (int24) {
        int24 mod = tick % TICK_SPACING;
        if (mod < 0) mod += TICK_SPACING;
        return tick - mod;
    }

    // ══════════════════════════════════════════════════════════════
    //  DISABLED ERC-4626 STANDARD FUNCTIONS
    //  (use custom deposit/withdraw above instead)
    // ══════════════════════════════════════════════════════════════

    /// @dev Disabled — use deposit(uint256 usdcAmount, uint256 ethAmount) instead.
    function deposit(uint256, address) public pure override returns (uint256) {
        revert("AutoVault: use deposit(usdc, eth)");
    }

    /// @dev Disabled — use withdraw(uint256 shares) instead.
    function withdraw(uint256, address, address) public pure override returns (uint256) {
        revert("AutoVault: use withdraw(shares)");
    }

    /// @dev Disabled.
    function mint(uint256, address) public pure override returns (uint256) {
        revert("AutoVault: use deposit(usdc, eth)");
    }

    /// @dev Disabled.
    function redeem(uint256, address, address) public pure override returns (uint256) {
        revert("AutoVault: use withdraw(shares)");
    }
}
