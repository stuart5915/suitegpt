// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SuiteYieldVault
 * @notice Vault for USDC deposits with instant withdrawals when liquid
 * @dev Users deposit USDC and can withdraw instantly if funds are available.
 *      Admin can deploy funds to yield strategies. When funds are deployed,
 *      withdrawals become requests that admin must process.
 */
contract SuiteYieldVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Base Mainnet USDC
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    // Credits per dollar (1000 credits = $1)
    uint256 public constant CREDITS_PER_DOLLAR = 1000;

    // Admin addresses
    mapping(address => bool) public isAdmin;

    // User deposit tracking
    mapping(address => uint256) public userDeposits;      // Total deposited (in USDC, 6 decimals)
    mapping(address => uint256) public userCredits;       // Credits earned from deposits
    mapping(address => uint256) public creditsUsed;       // Credits spent on services

    // Withdrawal requests (when not enough liquid)
    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestedAt;
        bool processed;
    }
    mapping(address => WithdrawalRequest[]) public withdrawalRequests;

    // Yield allocation preference (percentage to keep vs fund apps, default 90%)
    mapping(address => uint8) public yieldKeepPercent;

    // Total stats
    uint256 public totalDeposits;
    uint256 public totalDeployed;  // Amount sent to yield strategies

    // Events
    event Deposited(address indexed user, uint256 amount, uint256 creditsGranted);
    event WithdrawnInstant(address indexed user, uint256 amount);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 requestId);
    event WithdrawalProcessed(address indexed user, uint256 amount, uint256 requestId);
    event DeployedToYield(address indexed admin, address indexed strategy, uint256 amount);
    event ReturnedFromYield(address indexed admin, uint256 amount);
    event CreditsUsed(address indexed user, uint256 amount);
    event YieldPreferenceSet(address indexed user, uint8 keepPercent);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }

    constructor(address[] memory _admins) {
        for (uint i = 0; i < _admins.length; i++) {
            isAdmin[_admins[i]] = true;
            emit AdminAdded(_admins[i]);
        }
    }

    // ============ USER FUNCTIONS ============

    /**
     * @notice Deposit USDC into the vault
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Transfer USDC from user to vault
        USDC.safeTransferFrom(msg.sender, address(this), amount);

        // Update user deposit balance
        userDeposits[msg.sender] += amount;
        totalDeposits += amount;

        // Grant credits (1000 credits per $1 USDC)
        uint256 credits = amount * CREDITS_PER_DOLLAR;
        userCredits[msg.sender] += credits;

        // Set default yield preference if not set
        if (yieldKeepPercent[msg.sender] == 0) {
            yieldKeepPercent[msg.sender] = 90; // Default 90% to user
        }

        emit Deposited(msg.sender, amount, credits);
    }

    /**
     * @notice Withdraw USDC from the vault
     * @dev Instant if liquid balance available, otherwise creates request
     * @param amount Amount of USDC to withdraw (6 decimals)
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(getWithdrawableAmount(msg.sender) >= amount, "Exceeds withdrawable");

        uint256 liquidBalance = getLiquidBalance();

        if (liquidBalance >= amount) {
            // Instant withdrawal
            userDeposits[msg.sender] -= amount;
            totalDeposits -= amount;

            // Reduce credits proportionally
            uint256 creditsToRemove = amount * CREDITS_PER_DOLLAR;
            if (userCredits[msg.sender] >= creditsToRemove) {
                userCredits[msg.sender] -= creditsToRemove;
            } else {
                userCredits[msg.sender] = 0;
            }

            USDC.safeTransfer(msg.sender, amount);
            emit WithdrawnInstant(msg.sender, amount);
        } else {
            // Create withdrawal request
            withdrawalRequests[msg.sender].push(WithdrawalRequest({
                amount: amount,
                requestedAt: block.timestamp,
                processed: false
            }));

            uint256 requestId = withdrawalRequests[msg.sender].length - 1;
            emit WithdrawalRequested(msg.sender, amount, requestId);
        }
    }

    /**
     * @notice Set yield allocation preference
     * @param keepPercent Percentage of yield to keep (10-90)
     */
    function setYieldPreference(uint8 keepPercent) external {
        require(keepPercent >= 10 && keepPercent <= 90, "Must be 10-90%");
        yieldKeepPercent[msg.sender] = keepPercent;
        emit YieldPreferenceSet(msg.sender, keepPercent);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get liquid USDC balance in vault (not deployed to yield)
     */
    function getLiquidBalance() public view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /**
     * @notice Get maximum withdrawable amount for a user
     * @dev Deposit minus credits used minus pending withdrawals
     */
    function getWithdrawableAmount(address user) public view returns (uint256) {
        uint256 deposit = userDeposits[user];
        uint256 used = creditsUsed[user] / CREDITS_PER_DOLLAR; // Convert credits to USDC
        uint256 pending = getPendingWithdrawals(user);

        if (deposit <= used + pending) return 0;
        return deposit - used - pending;
    }

    /**
     * @notice Get pending withdrawal amount for a user
     */
    function getPendingWithdrawals(address user) public view returns (uint256) {
        uint256 pending = 0;
        for (uint i = 0; i < withdrawalRequests[user].length; i++) {
            if (!withdrawalRequests[user][i].processed) {
                pending += withdrawalRequests[user][i].amount;
            }
        }
        return pending;
    }

    /**
     * @notice Get user's spendable credits
     */
    function getSpendableCredits(address user) public view returns (uint256) {
        if (userCredits[user] <= creditsUsed[user]) return 0;
        return userCredits[user] - creditsUsed[user];
    }

    /**
     * @notice Get user's full position
     */
    function getUserPosition(address user) external view returns (
        uint256 deposited,
        uint256 credits,
        uint256 used,
        uint256 withdrawable,
        uint256 pending,
        uint8 yieldPref
    ) {
        return (
            userDeposits[user],
            userCredits[user],
            creditsUsed[user],
            getWithdrawableAmount(user),
            getPendingWithdrawals(user),
            yieldKeepPercent[user]
        );
    }

    /**
     * @notice Get withdrawal requests for a user
     */
    function getWithdrawalRequests(address user) external view returns (WithdrawalRequest[] memory) {
        return withdrawalRequests[user];
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Deploy USDC to yield strategy (e.g., Morpho)
     * @param strategy Address to send USDC to
     * @param amount Amount to deploy
     */
    function deployToYield(address strategy, uint256 amount) external onlyAdmin {
        require(amount <= getLiquidBalance(), "Not enough liquid");

        totalDeployed += amount;
        USDC.safeTransfer(strategy, amount);

        emit DeployedToYield(msg.sender, strategy, amount);
    }

    /**
     * @notice Return USDC from yield strategy
     * @param amount Amount returned (must be transferred to this contract first)
     */
    function returnFromYield(uint256 amount) external onlyAdmin {
        require(totalDeployed >= amount, "Exceeds deployed");
        totalDeployed -= amount;

        emit ReturnedFromYield(msg.sender, amount);
    }

    /**
     * @notice Process a pending withdrawal request
     * @param user User address
     * @param requestId Index of the withdrawal request
     */
    function processWithdrawal(address user, uint256 requestId) external onlyAdmin nonReentrant {
        require(requestId < withdrawalRequests[user].length, "Invalid request");
        WithdrawalRequest storage request = withdrawalRequests[user][requestId];
        require(!request.processed, "Already processed");
        require(getLiquidBalance() >= request.amount, "Not enough liquid");

        request.processed = true;

        userDeposits[user] -= request.amount;
        totalDeposits -= request.amount;

        // Reduce credits proportionally
        uint256 creditsToRemove = request.amount * CREDITS_PER_DOLLAR;
        if (userCredits[user] >= creditsToRemove) {
            userCredits[user] -= creditsToRemove;
        } else {
            userCredits[user] = 0;
        }

        USDC.safeTransfer(user, request.amount);

        emit WithdrawalProcessed(user, request.amount, requestId);
    }

    /**
     * @notice Mark credits as used (called by authorized services)
     * @param user User address
     * @param amount Credits to mark as used
     */
    function useCredits(address user, uint256 amount) external onlyAdmin {
        require(getSpendableCredits(user) >= amount, "Not enough credits");
        creditsUsed[user] += amount;
        emit CreditsUsed(user, amount);
    }

    /**
     * @notice Add an admin
     */
    function addAdmin(address admin) external onlyAdmin {
        isAdmin[admin] = true;
        emit AdminAdded(admin);
    }

    /**
     * @notice Remove an admin
     */
    function removeAdmin(address admin) external onlyAdmin {
        require(admin != msg.sender, "Cannot remove self");
        isAdmin[admin] = false;
        emit AdminRemoved(admin);
    }

    /**
     * @notice Emergency withdraw all USDC (admin only)
     */
    function emergencyWithdraw() external onlyAdmin {
        uint256 balance = USDC.balanceOf(address(this));
        USDC.safeTransfer(msg.sender, balance);
    }
}
