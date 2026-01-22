// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ISuiteStaking
 * @dev Interface for SuiteStaking contract
 */
interface ISuiteStaking {
    function bonusCredits(address user) external view returns (uint256);
    function totalBonusCredits() external view returns (uint256);
    function redeemBonusCredits(address user, uint256 amount) external;
}

/**
 * @title UsdcWithdrawals
 * @dev Redemption pool for bonus credits
 *
 * How it works:
 * 1. Admin earns yield from treasury (Aave, etc.)
 * 2. Admin deposits USDC to this pool when ready to distribute
 * 3. Users can redeem their bonus credits for proportional share of pool
 * 4. Redemption rate = totalRedeemableUsdc / totalBonusCredits
 *
 * Example:
 * - 10 users, each has 100,000 bonus credits = 1,000,000 total
 * - Admin deposits $800 to pool
 * - Redemption rate = $800 / 1,000,000 = 80%
 * - Each user can redeem 100,000 credits for $80
 *
 * Over time:
 * - Admin earns more yield, deposits more
 * - Pool grows to $1,200
 * - Rate = $1,200 / 1,000,000 = 120%
 * - Each user can now get $120 (more than face value!)
 */
contract UsdcWithdrawals is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public usdc;
    ISuiteStaking public staking;

    /// @notice Total USDC available for redemption
    uint256 public totalRedeemableUsdc;

    /// @notice Total USDC redeemed all-time (for stats)
    uint256 public totalRedeemedUsdc;

    // ============ Events ============

    event PoolDeposit(uint256 amount, address indexed depositor);
    event PoolWithdraw(uint256 amount, address indexed withdrawer);
    event Redeemed(address indexed user, uint256 creditsRedeemed, uint256 usdcReceived);

    // ============ Errors ============

    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBonusCredits();
    error InsufficientPool();
    error NothingToRedeem();

    // ============ Constructor ============

    constructor(address _usdc, address _staking, address _owner) Ownable(_owner) {
        if (_usdc == address(0) || _staking == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        staking = ISuiteStaking(_staking);
    }

    // ============ View Functions ============

    /**
     * @notice Get current redemption rate (USDC per credit, scaled by 1e18)
     * @return rate USDC per credit (multiply by credits, divide by 1e18)
     *
     * Example: rate = 0.0008e18 means 1 credit = $0.0008 USDC
     * Or: 1000 credits = $0.80 (at 80% redemption)
     */
    function getRedemptionRate() public view returns (uint256) {
        uint256 totalBonus = staking.totalBonusCredits();
        if (totalBonus == 0) return 0;

        // Scale by 1e18 for precision
        // totalRedeemableUsdc is 6 decimals, totalBonus is 18 decimals
        // Result: USDC per credit scaled by 1e18
        return (totalRedeemableUsdc * 1e18 * 1e12) / totalBonus;
    }

    /**
     * @notice Get redemption rate as a percentage (100% = 1e18)
     * @return percentage 1e18 = 100% (face value), 0.8e18 = 80%, 1.2e18 = 120%
     *
     * Face value: 1000 credits = $1 USDC
     */
    function getRedemptionPercentage() public view returns (uint256) {
        uint256 totalBonus = staking.totalBonusCredits();
        if (totalBonus == 0) return 0;

        // Face value: 1000 credits (1000e18) = $1 USDC (1e6)
        // So totalBonus credits should equal totalBonus / 1000 / 1e12 USDC at 100%
        uint256 faceValueUsdc = totalBonus / 1000 / 1e12;
        if (faceValueUsdc == 0) return 0;

        return (totalRedeemableUsdc * 1e18) / faceValueUsdc;
    }

    /**
     * @notice Get how much USDC a user can redeem for their bonus credits
     * @param user Address to check
     * @return usdcAmount Amount of USDC they can get
     */
    function getRedeemableAmount(address user) public view returns (uint256) {
        uint256 userBonus = staking.bonusCredits(user);
        if (userBonus == 0) return 0;

        uint256 rate = getRedemptionRate();
        if (rate == 0) return 0;

        // userBonus is 18 decimals, rate is scaled by 1e18
        // Result needs to be 6 decimals (USDC)
        return (userBonus * rate) / 1e18 / 1e12;
    }

    /**
     * @notice Calculate USDC for a specific credit amount
     * @param creditAmount Credits to convert (18 decimals)
     * @return usdcAmount USDC equivalent (6 decimals)
     */
    function creditsToUsdc(uint256 creditAmount) public view returns (uint256) {
        uint256 rate = getRedemptionRate();
        if (rate == 0) return 0;

        return (creditAmount * rate) / 1e18 / 1e12;
    }

    // ============ User Functions ============

    /**
     * @notice Redeem bonus credits for USDC
     * @param creditAmount Amount of bonus credits to redeem (18 decimals)
     *
     * User redeems credits → gets proportional USDC from pool
     * Credits are burned, pool decreases
     */
    function redeem(uint256 creditAmount) external nonReentrant {
        if (creditAmount == 0) revert ZeroAmount();

        uint256 userBonus = staking.bonusCredits(msg.sender);
        if (creditAmount > userBonus) revert InsufficientBonusCredits();

        uint256 usdcAmount = creditsToUsdc(creditAmount);
        if (usdcAmount == 0) revert NothingToRedeem();
        if (usdcAmount > totalRedeemableUsdc) revert InsufficientPool();

        // Burn the credits from user's balance
        staking.redeemBonusCredits(msg.sender, creditAmount);

        // Update pool
        totalRedeemableUsdc -= usdcAmount;
        totalRedeemedUsdc += usdcAmount;

        // Transfer USDC to user
        usdc.safeTransfer(msg.sender, usdcAmount);

        emit Redeemed(msg.sender, creditAmount, usdcAmount);
    }

    /**
     * @notice Redeem ALL bonus credits for USDC
     */
    function redeemAll() external nonReentrant {
        uint256 userBonus = staking.bonusCredits(msg.sender);
        if (userBonus == 0) revert InsufficientBonusCredits();

        uint256 usdcAmount = creditsToUsdc(userBonus);
        if (usdcAmount == 0) revert NothingToRedeem();
        if (usdcAmount > totalRedeemableUsdc) revert InsufficientPool();

        // Burn all credits
        staking.redeemBonusCredits(msg.sender, userBonus);

        // Update pool
        totalRedeemableUsdc -= usdcAmount;
        totalRedeemedUsdc += usdcAmount;

        // Transfer USDC
        usdc.safeTransfer(msg.sender, usdcAmount);

        emit Redeemed(msg.sender, userBonus, usdcAmount);
    }

    // ============ Admin Functions ============

    /**
     * @notice Add USDC to the redemption pool
     * @param amount Amount of USDC to add (6 decimals)
     *
     * Call this when you want to distribute yield to users.
     * The more you add, the higher the redemption rate.
     */
    function depositToPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalRedeemableUsdc += amount;

        emit PoolDeposit(amount, msg.sender);
    }

    /**
     * @notice Remove USDC from the redemption pool
     * @param amount Amount of USDC to remove
     *
     * Use if you need to reduce the pool (adjusting rate, emergency, etc.)
     */
    function withdrawFromPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > totalRedeemableUsdc) revert InsufficientPool();

        totalRedeemableUsdc -= amount;
        usdc.safeTransfer(msg.sender, amount);

        emit PoolWithdraw(amount, msg.sender);
    }

    /**
     * @notice Update the staking contract reference
     * @param _staking New staking contract address
     */
    function setStakingContract(address _staking) external onlyOwner {
        if (_staking == address(0)) revert ZeroAddress();
        staking = ISuiteStaking(_staking);
    }

    /**
     * @notice Emergency: recover accidentally sent tokens
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        // Don't allow recovering USDC that's in the pool
        if (token == address(usdc)) {
            uint256 excess = usdc.balanceOf(address(this)) - totalRedeemableUsdc;
            require(amount <= excess, "Cannot withdraw pool USDC");
        }
        IERC20(token).safeTransfer(owner(), amount);
    }
}
