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
    function restoreBonusCredits(address user, uint256 amount) external;
}

/**
 * @title UsdcWithdrawals
 * @dev Redemption system for bonus credits with admin-controlled liquidity
 *
 * Flow:
 * 1. Admin reports "liquid value" - how much is available for redemption
 * 2. Users can request up to their proportional share
 * 3. Admin sees total pending requests
 * 4. Admin funds the pool with a single USDC deposit
 * 5. Users claim their requested amount from the pool
 *
 * Example:
 * - Total bonus credits: 1,000,000 (10 users with 100k each)
 * - Admin reports liquid value: $800
 * - Rate = 80%, each user can request up to $80
 * - 5 users request, total pending = $300
 * - Admin deposits $300 to pool
 * - Those 5 users claim their USDC
 */
contract UsdcWithdrawals is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public usdc;
    ISuiteStaking public staking;

    /// @notice Admin-reported liquid value available for redemption (6 decimals, USDC)
    uint256 public reportedLiquidValue;

    /// @notice Pending redemption requests per user (in USDC, 6 decimals)
    mapping(address => uint256) public pendingRequests;

    /// @notice Credits locked for pending requests (18 decimals)
    mapping(address => uint256) public lockedCredits;

    /// @notice Total pending requests across all users (USDC)
    uint256 public totalPendingRequests;

    /// @notice Total credits locked for pending requests
    uint256 public totalLockedCredits;

    /// @notice USDC available in pool for claims
    uint256 public fundedPool;

    /// @notice Total USDC claimed all-time (for stats)
    uint256 public totalClaimedUsdc;

    // ============ Events ============

    event LiquidValueReported(uint256 newValue, uint256 oldValue);
    event RedemptionRequested(address indexed user, uint256 credits, uint256 usdcAmount);
    event RedemptionCancelled(address indexed user, uint256 credits, uint256 usdcAmount);
    event PoolFunded(uint256 amount, address indexed funder);
    event Claimed(address indexed user, uint256 usdcAmount);

    // ============ Errors ============

    error ZeroAmount();
    error ZeroAddress();
    error ExceedsMaxRedeemable();
    error NoPendingRequest();
    error InsufficientPool();
    error AlreadyHasPendingRequest();

    // ============ Constructor ============

    constructor(address _usdc, address _staking, address _owner) Ownable(_owner) {
        if (_usdc == address(0) || _staking == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        staking = ISuiteStaking(_staking);
    }

    // ============ View Functions ============

    /**
     * @notice Get redemption rate as percentage (1e18 = 100%)
     * @return percentage e.g., 0.8e18 = 80%, 1.2e18 = 120%
     */
    function getRedemptionPercentage() public view returns (uint256) {
        uint256 totalBonus = staking.totalBonusCredits();
        if (totalBonus == 0) return 0;

        // Face value: 1000 credits = $1 USDC
        // totalBonus / 1000 / 1e12 = face value in USDC
        uint256 faceValueUsdc = totalBonus / 1000 / 1e12;
        if (faceValueUsdc == 0) return 0;

        return (reportedLiquidValue * 1e18) / faceValueUsdc;
    }

    /**
     * @notice Get max USDC a user can request based on their bonus credits
     * @param user Address to check
     * @return maxUsdc Maximum USDC they can request (6 decimals)
     */
    function getMaxRedeemable(address user) public view returns (uint256) {
        uint256 userBonus = staking.bonusCredits(user);
        if (userBonus == 0 || reportedLiquidValue == 0) return 0;

        uint256 totalBonus = staking.totalBonusCredits();
        if (totalBonus == 0) return 0;

        // User's share of reported liquid value
        return (userBonus * reportedLiquidValue) / totalBonus;
    }

    /**
     * @notice Convert credits to USDC at current rate
     * @param credits Amount of credits (18 decimals)
     * @return usdcAmount USDC value (6 decimals)
     */
    function creditsToUsdc(uint256 credits) public view returns (uint256) {
        uint256 totalBonus = staking.totalBonusCredits();
        if (totalBonus == 0 || reportedLiquidValue == 0) return 0;

        return (credits * reportedLiquidValue) / totalBonus;
    }

    /**
     * @notice Convert USDC to credits at current rate
     * @param usdcAmount Amount of USDC (6 decimals)
     * @return credits Credit value (18 decimals)
     */
    function usdcToCredits(uint256 usdcAmount) public view returns (uint256) {
        uint256 totalBonus = staking.totalBonusCredits();
        if (reportedLiquidValue == 0) return 0;

        return (usdcAmount * totalBonus) / reportedLiquidValue;
    }

    // ============ User Functions ============

    /**
     * @notice Request to redeem bonus credits for USDC
     * @param usdcAmount Amount of USDC to request (6 decimals)
     *
     * User requests based on USDC amount they want.
     * Must be <= their max redeemable.
     * Credits are locked until claim or cancel.
     */
    function requestRedemption(uint256 usdcAmount) external nonReentrant {
        if (usdcAmount == 0) revert ZeroAmount();
        if (pendingRequests[msg.sender] > 0) revert AlreadyHasPendingRequest();

        uint256 maxRedeemable = getMaxRedeemable(msg.sender);
        if (usdcAmount > maxRedeemable) revert ExceedsMaxRedeemable();

        // Calculate credits to lock
        uint256 creditsToLock = usdcToCredits(usdcAmount);

        // Lock the credits (burn from staking contract)
        staking.redeemBonusCredits(msg.sender, creditsToLock);

        // Record the request
        pendingRequests[msg.sender] = usdcAmount;
        lockedCredits[msg.sender] = creditsToLock;
        totalPendingRequests += usdcAmount;
        totalLockedCredits += creditsToLock;

        emit RedemptionRequested(msg.sender, creditsToLock, usdcAmount);
    }

    /**
     * @notice Request to redeem ALL bonus credits for USDC
     */
    function requestRedemptionAll() external nonReentrant {
        if (pendingRequests[msg.sender] > 0) revert AlreadyHasPendingRequest();

        uint256 usdcAmount = getMaxRedeemable(msg.sender);
        if (usdcAmount == 0) revert ZeroAmount();

        uint256 userBonus = staking.bonusCredits(msg.sender);

        // Lock all credits
        staking.redeemBonusCredits(msg.sender, userBonus);

        // Record the request
        pendingRequests[msg.sender] = usdcAmount;
        lockedCredits[msg.sender] = userBonus;
        totalPendingRequests += usdcAmount;
        totalLockedCredits += userBonus;

        emit RedemptionRequested(msg.sender, userBonus, usdcAmount);
    }

    /**
     * @notice Cancel pending redemption request
     * @dev Returns locked credits to user
     */
    function cancelRequest() external nonReentrant {
        uint256 pending = pendingRequests[msg.sender];
        if (pending == 0) revert NoPendingRequest();

        uint256 credits = lockedCredits[msg.sender];

        // Clear request
        pendingRequests[msg.sender] = 0;
        lockedCredits[msg.sender] = 0;
        totalPendingRequests -= pending;
        totalLockedCredits -= credits;

        // Return credits to user
        staking.restoreBonusCredits(msg.sender, credits);

        emit RedemptionCancelled(msg.sender, credits, pending);
    }

    /**
     * @notice Claim USDC from funded pool
     */
    function claim() external nonReentrant {
        uint256 pending = pendingRequests[msg.sender];
        if (pending == 0) revert NoPendingRequest();
        if (pending > fundedPool) revert InsufficientPool();

        // Clear request
        uint256 credits = lockedCredits[msg.sender];
        pendingRequests[msg.sender] = 0;
        lockedCredits[msg.sender] = 0;
        totalPendingRequests -= pending;
        totalLockedCredits -= credits;

        // Reduce pool and transfer
        fundedPool -= pending;
        totalClaimedUsdc += pending;

        usdc.safeTransfer(msg.sender, pending);

        emit Claimed(msg.sender, pending);
    }

    // ============ Admin Functions ============

    /**
     * @notice Report the liquid value available for redemption
     * @param newValue New liquid value in USDC (6 decimals)
     *
     * This controls the redemption rate:
     * rate = reportedLiquidValue / totalBonusCredits
     *
     * Set this to how much you're willing to pay out.
     * Example: $800 reported for 1M credits = 80% rate
     */
    function reportLiquidValue(uint256 newValue) external onlyOwner {
        uint256 oldValue = reportedLiquidValue;
        reportedLiquidValue = newValue;
        emit LiquidValueReported(newValue, oldValue);
    }

    /**
     * @notice Fund the pool with USDC
     * @param amount Amount of USDC to add (6 decimals)
     *
     * Single transaction to fund all pending requests.
     * Check totalPendingRequests to see how much is needed.
     */
    function fundPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        fundedPool += amount;

        emit PoolFunded(amount, msg.sender);
    }

    /**
     * @notice Withdraw excess USDC from pool
     * @param amount Amount to withdraw
     */
    function withdrawFromPool(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (amount > fundedPool) revert InsufficientPool();

        fundedPool -= amount;
        usdc.safeTransfer(msg.sender, amount);
    }

    /**
     * @notice Update the staking contract reference
     */
    function setStakingContract(address _staking) external onlyOwner {
        if (_staking == address(0)) revert ZeroAddress();
        staking = ISuiteStaking(_staking);
    }

    /**
     * @notice Emergency: recover accidentally sent tokens
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(usdc)) {
            uint256 excess = usdc.balanceOf(address(this)) - fundedPool;
            require(amount <= excess, "Cannot withdraw pool USDC");
        }
        IERC20(token).safeTransfer(owner(), amount);
    }
}
