// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TreasuryVault
 * @notice SUITE Treasury with multi-admin management, value reporting, and withdrawal queue
 */
contract TreasuryVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    // Multi-admin support
    mapping(address => bool) public isAdmin;
    address[] public adminList;
    
    // Treasury value (reported by admin, may differ from actual balance)
    uint256 public treasuryValue;
    uint256 public estimatedAPY; // In basis points (e.g., 2000 = 20%)
    uint256 public lastValueUpdate;
    
    // Liquid reserve target (basis points, e.g., 2000 = 20%)
    uint256 public liquidReserveTarget = 2000;
    
    // Withdrawal queue
    uint256 public withdrawalDelay = 3 days;
    uint256 public instantWithdrawLimit = 1 ether; // Up to this amount = instant
    
    struct WithdrawalRequest {
        uint256 amount;
        uint256 requestTime;
        uint256 readyTime;
        bool processed;
    }
    
    mapping(address => WithdrawalRequest) public pendingWithdrawals;
    address[] public withdrawalQueue;
    
    // Pause functionality
    bool public withdrawalsPaused;
    bool public depositsPaused;

    // ============================================
    // EVENTS
    // ============================================
    
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event TreasuryValueUpdated(uint256 oldValue, uint256 newValue, uint256 timestamp);
    event APYUpdated(uint256 oldAPY, uint256 newAPY);
    event WithdrawnToAdmin(address indexed admin, uint256 amount);
    event DepositedFromAdmin(address indexed admin, uint256 amount);
    event WithdrawalRequested(address indexed user, uint256 amount, uint256 readyTime);
    event WithdrawalProcessed(address indexed user, uint256 amount);
    event WithdrawalCancelled(address indexed user, uint256 amount);

    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }

    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(address[] memory _admins) {
        require(_admins.length > 0, "Need at least one admin");
        
        for (uint i = 0; i < _admins.length; i++) {
            require(_admins[i] != address(0), "Invalid admin address");
            isAdmin[_admins[i]] = true;
            adminList.push(_admins[i]);
            emit AdminAdded(_admins[i]);
        }
        
        lastValueUpdate = block.timestamp;
    }

    // ============================================
    // ADMIN MANAGEMENT
    // ============================================
    
    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid address");
        require(!isAdmin[newAdmin], "Already admin");
        
        isAdmin[newAdmin] = true;
        adminList.push(newAdmin);
        emit AdminAdded(newAdmin);
    }
    
    function removeAdmin(address oldAdmin) external onlyAdmin {
        require(isAdmin[oldAdmin], "Not an admin");
        require(adminList.length > 1, "Cannot remove last admin");
        
        isAdmin[oldAdmin] = false;
        
        // Remove from list
        for (uint i = 0; i < adminList.length; i++) {
            if (adminList[i] == oldAdmin) {
                adminList[i] = adminList[adminList.length - 1];
                adminList.pop();
                break;
            }
        }
        
        emit AdminRemoved(oldAdmin);
    }
    
    function getAdminCount() external view returns (uint256) {
        return adminList.length;
    }
    
    function getAdmins() external view returns (address[] memory) {
        return adminList;
    }

    // ============================================
    // VALUE REPORTING
    // ============================================
    
    /**
     * @notice Update the reported treasury value (includes deployed positions)
     * @param newValue Total value in wei (ETH equivalent)
     */
    function updateTreasuryValue(uint256 newValue) external onlyAdmin {
        uint256 oldValue = treasuryValue;
        treasuryValue = newValue;
        lastValueUpdate = block.timestamp;
        emit TreasuryValueUpdated(oldValue, newValue, block.timestamp);
    }
    
    /**
     * @notice Update estimated APY
     * @param newAPY APY in basis points (2000 = 20%)
     */
    function updateEstimatedAPY(uint256 newAPY) external onlyAdmin {
        uint256 oldAPY = estimatedAPY;
        estimatedAPY = newAPY;
        emit APYUpdated(oldAPY, newAPY);
    }

    // ============================================
    // FUND MANAGEMENT (Admin)
    // ============================================
    
    /**
     * @notice Withdraw ETH to admin wallet for deployment
     */
    function withdrawToAdmin(uint256 amount) external onlyAdmin nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit WithdrawnToAdmin(msg.sender, amount);
    }
    
    /**
     * @notice Deposit ETH from admin wallet back to treasury
     */
    function depositFromAdmin() external payable onlyAdmin {
        require(msg.value > 0, "No ETH sent");
        emit DepositedFromAdmin(msg.sender, msg.value);
    }
    
    /**
     * @notice Set liquid reserve target
     * @param basisPoints Target in basis points (2000 = 20%)
     */
    function setLiquidReserveTarget(uint256 basisPoints) external onlyAdmin {
        require(basisPoints <= 10000, "Cannot exceed 100%");
        liquidReserveTarget = basisPoints;
    }
    
    /**
     * @notice Set withdrawal delay
     */
    function setWithdrawalDelay(uint256 delay) external onlyAdmin {
        require(delay <= 7 days, "Max 7 days");
        withdrawalDelay = delay;
    }
    
    /**
     * @notice Set instant withdrawal limit
     */
    function setInstantWithdrawLimit(uint256 limit) external onlyAdmin {
        instantWithdrawLimit = limit;
    }

    // ============================================
    // PAUSE CONTROLS
    // ============================================
    
    function pauseWithdrawals(bool paused) external onlyAdmin {
        withdrawalsPaused = paused;
    }
    
    function pauseDeposits(bool paused) external onlyAdmin {
        depositsPaused = paused;
    }

    // ============================================
    // USER DEPOSITS (Receive ETH)
    // ============================================
    
    receive() external payable {
        require(!depositsPaused, "Deposits paused");
    }

    // ============================================
    // USER WITHDRAWALS (Queue System)
    // ============================================
    
    /**
     * @notice Request a withdrawal (may be instant or queued)
     * @param amount Amount to withdraw in ETH
     */
    function requestWithdrawal(uint256 amount) external nonReentrant {
        require(!withdrawalsPaused, "Withdrawals paused");
        require(amount > 0, "Amount must be > 0");
        require(pendingWithdrawals[msg.sender].amount == 0, "Already have pending withdrawal");
        
        // Check if instant withdrawal is possible
        if (amount <= instantWithdrawLimit && address(this).balance >= amount) {
            // Instant withdrawal
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
            emit WithdrawalProcessed(msg.sender, amount);
        } else {
            // Queue withdrawal
            uint256 readyTime = block.timestamp + withdrawalDelay;
            pendingWithdrawals[msg.sender] = WithdrawalRequest({
                amount: amount,
                requestTime: block.timestamp,
                readyTime: readyTime,
                processed: false
            });
            withdrawalQueue.push(msg.sender);
            emit WithdrawalRequested(msg.sender, amount, readyTime);
        }
    }
    
    /**
     * @notice Process a ready withdrawal
     */
    function processWithdrawal(address user) external nonReentrant {
        WithdrawalRequest storage request = pendingWithdrawals[user];
        require(request.amount > 0, "No pending withdrawal");
        require(!request.processed, "Already processed");
        require(block.timestamp >= request.readyTime, "Not ready yet");
        require(address(this).balance >= request.amount, "Insufficient liquidity");
        
        request.processed = true;
        uint256 amount = request.amount;
        
        // Clear the request
        delete pendingWithdrawals[user];
        
        (bool success, ) = user.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit WithdrawalProcessed(user, amount);
    }
    
    /**
     * @notice Cancel pending withdrawal
     */
    function cancelWithdrawal() external {
        WithdrawalRequest storage request = pendingWithdrawals[msg.sender];
        require(request.amount > 0, "No pending withdrawal");
        require(!request.processed, "Already processed");
        
        uint256 amount = request.amount;
        delete pendingWithdrawals[msg.sender];
        
        emit WithdrawalCancelled(msg.sender, amount);
    }
    
    /**
     * @notice Get pending withdrawals count
     */
    function getPendingWithdrawalsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint i = 0; i < withdrawalQueue.length; i++) {
            if (pendingWithdrawals[withdrawalQueue[i]].amount > 0 && 
                !pendingWithdrawals[withdrawalQueue[i]].processed) {
                count++;
            }
        }
        return count;
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get actual ETH balance in contract
     */
    function getActualBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Get required liquid reserve based on target
     */
    function getRequiredLiquidReserve() external view returns (uint256) {
        return (treasuryValue * liquidReserveTarget) / 10000;
    }
    
    /**
     * @notice Check if more liquidity is needed
     */
    function needsMoreLiquidity() external view returns (bool) {
        uint256 required = (treasuryValue * liquidReserveTarget) / 10000;
        return address(this).balance < required;
    }
}
