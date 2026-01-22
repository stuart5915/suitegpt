// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UsdcWithdrawals
 * @dev Handle USDC withdrawal requests for advanced users
 *
 * Flow:
 * 1. User has bonus credits from rewards
 * 2. User requests to withdraw credits as USDC
 * 3. Treasury sees request and funds it
 * 4. User claims the funded USDC
 *
 * This allows capital-efficient treasury management:
 * - USDC stays earning yield until someone actually wants to withdraw
 * - No USDC sitting idle in a reward pool
 */
contract UsdcWithdrawals is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public usdc;

    /// @notice Credits per USDC (1000 credits = $1 USDC)
    uint256 public constant CREDITS_PER_USDC = 1000;

    /// @notice Pending withdrawal requests (in credits)
    mapping(address => uint256) public pendingWithdrawals;

    /// @notice Funded withdrawals ready to claim (in USDC, 6 decimals)
    mapping(address => uint256) public fundedWithdrawals;

    /// @notice Total pending withdrawal requests (in credits)
    uint256 public totalPendingCredits;

    /// @notice Total funded but unclaimed (in USDC)
    uint256 public totalFundedUsdc;

    // ============ Events ============

    event WithdrawalRequested(address indexed user, uint256 credits, uint256 usdcEquivalent);
    event WithdrawalFunded(address indexed user, uint256 usdcAmount, address indexed funder);
    event WithdrawalClaimed(address indexed user, uint256 usdcAmount);
    event WithdrawalCancelled(address indexed user, uint256 credits);

    // ============ Errors ============

    error ZeroAmount();
    error ZeroAddress();
    error NoPendingWithdrawal();
    error NoFundedWithdrawal();
    error InsufficientFunding();

    // ============ Constructor ============

    constructor(address _usdc, address _owner) Ownable(_owner) {
        if (_usdc == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
    }

    // ============ View Functions ============

    /**
     * @notice Convert credits to USDC amount
     * @param credits Amount in credits (18 decimals like SUITE)
     * @return USDC amount (6 decimals)
     */
    function creditsToUsdc(uint256 credits) public pure returns (uint256) {
        // credits (18 decimals) / 1000 / 1e12 = USDC (6 decimals)
        return credits / CREDITS_PER_USDC / 1e12;
    }

    /**
     * @notice Convert USDC to credits amount
     * @param usdcAmount Amount in USDC (6 decimals)
     * @return Credits amount (18 decimals)
     */
    function usdcToCredits(uint256 usdcAmount) public pure returns (uint256) {
        // USDC (6 decimals) * 1000 * 1e12 = credits (18 decimals)
        return usdcAmount * CREDITS_PER_USDC * 1e12;
    }

    /**
     * @notice Get pending withdrawal in both credits and USDC
     * @param user Address to check
     * @return credits Pending credits
     * @return usdcEquivalent Equivalent USDC value
     */
    function getPendingWithdrawal(address user) external view returns (uint256 credits, uint256 usdcEquivalent) {
        credits = pendingWithdrawals[user];
        usdcEquivalent = creditsToUsdc(credits);
    }

    /**
     * @notice Get total pending across all users
     * @return credits Total pending credits
     * @return usdcEquivalent Equivalent USDC value
     */
    function getTotalPending() external view returns (uint256 credits, uint256 usdcEquivalent) {
        credits = totalPendingCredits;
        usdcEquivalent = creditsToUsdc(credits);
    }

    // ============ User Functions ============

    /**
     * @notice Request to withdraw bonus credits as USDC
     * @param credits Amount of bonus credits to withdraw
     *
     * NOTE: This should be called after reducing user's bonusCredits in SuiteStaking
     * The frontend/backend should coordinate:
     * 1. Call SuiteStaking to reduce bonusCredits
     * 2. Call this to create withdrawal request
     */
    function requestWithdrawal(uint256 credits) external nonReentrant {
        if (credits == 0) revert ZeroAmount();

        pendingWithdrawals[msg.sender] += credits;
        totalPendingCredits += credits;

        uint256 usdcEquivalent = creditsToUsdc(credits);
        emit WithdrawalRequested(msg.sender, credits, usdcEquivalent);
    }

    /**
     * @notice Cancel a pending withdrawal request
     * @dev User may want to cancel and keep credits instead
     */
    function cancelWithdrawal() external nonReentrant {
        uint256 pending = pendingWithdrawals[msg.sender];
        if (pending == 0) revert NoPendingWithdrawal();

        pendingWithdrawals[msg.sender] = 0;
        totalPendingCredits -= pending;

        emit WithdrawalCancelled(msg.sender, pending);
    }

    /**
     * @notice Claim funded USDC withdrawal
     */
    function claimUsdc() external nonReentrant {
        uint256 amount = fundedWithdrawals[msg.sender];
        if (amount == 0) revert NoFundedWithdrawal();

        fundedWithdrawals[msg.sender] = 0;
        totalFundedUsdc -= amount;

        usdc.safeTransfer(msg.sender, amount);
        emit WithdrawalClaimed(msg.sender, amount);
    }

    // ============ Admin/Treasury Functions ============

    /**
     * @notice Fund a user's pending withdrawal
     * @param user Address whose withdrawal to fund
     * @param usdcAmount Amount of USDC to deposit for this user
     *
     * Treasury flow:
     * 1. See pending withdrawals via events or view functions
     * 2. Withdraw USDC from yield protocol
     * 3. Approve this contract
     * 4. Call fundWithdrawal
     */
    function fundWithdrawal(address user, uint256 usdcAmount) external nonReentrant onlyOwner {
        if (user == address(0)) revert ZeroAddress();
        if (usdcAmount == 0) revert ZeroAmount();

        uint256 pendingCredits = pendingWithdrawals[user];
        if (pendingCredits == 0) revert NoPendingWithdrawal();

        uint256 pendingUsdc = creditsToUsdc(pendingCredits);

        // Can fund partial or full amount
        uint256 fundingAmount = usdcAmount > pendingUsdc ? pendingUsdc : usdcAmount;
        uint256 creditsFunded = usdcToCredits(fundingAmount);

        // Transfer USDC from treasury/owner
        usdc.safeTransferFrom(msg.sender, address(this), fundingAmount);

        // Update state
        pendingWithdrawals[user] -= creditsFunded;
        totalPendingCredits -= creditsFunded;
        fundedWithdrawals[user] += fundingAmount;
        totalFundedUsdc += fundingAmount;

        emit WithdrawalFunded(user, fundingAmount, msg.sender);
    }

    /**
     * @notice Fund multiple withdrawals in one transaction
     * @param users Array of user addresses
     * @param usdcAmounts Array of USDC amounts to fund for each user
     */
    function fundWithdrawalsBatch(
        address[] calldata users,
        uint256[] calldata usdcAmounts
    ) external nonReentrant onlyOwner {
        require(users.length == usdcAmounts.length, "Array length mismatch");

        uint256 totalUsdc = 0;

        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 usdcAmount = usdcAmounts[i];

            if (user == address(0) || usdcAmount == 0) continue;

            uint256 pendingCredits = pendingWithdrawals[user];
            if (pendingCredits == 0) continue;

            uint256 pendingUsdc = creditsToUsdc(pendingCredits);
            uint256 fundingAmount = usdcAmount > pendingUsdc ? pendingUsdc : usdcAmount;
            uint256 creditsFunded = usdcToCredits(fundingAmount);

            pendingWithdrawals[user] -= creditsFunded;
            totalPendingCredits -= creditsFunded;
            fundedWithdrawals[user] += fundingAmount;
            totalFundedUsdc += fundingAmount;
            totalUsdc += fundingAmount;

            emit WithdrawalFunded(user, fundingAmount, msg.sender);
        }

        // Transfer total USDC in one call
        if (totalUsdc > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), totalUsdc);
        }
    }

    /**
     * @notice Emergency: recover accidentally sent tokens
     */
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        // Don't allow recovering USDC that's allocated for withdrawals
        if (token == address(usdc)) {
            uint256 unallocated = usdc.balanceOf(address(this)) - totalFundedUsdc;
            require(amount <= unallocated, "Cannot withdraw allocated USDC");
        }
        IERC20(token).safeTransfer(owner(), amount);
    }
}
