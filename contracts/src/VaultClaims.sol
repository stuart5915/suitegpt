// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VaultClaims
 * @notice Simple contract for users to claim approved USDC withdrawals
 * @dev Admin deposits USDC, approves amounts, users claim
 */
contract VaultClaims is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Base USDC address
    IERC20 public constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    // Admin wallets (can add/remove admins, approve claims, deposit/withdraw)
    mapping(address => bool) public isAdmin;

    // Approved claim amounts per user
    mapping(address => uint256) public claimableAmount;

    // Track total approved but unclaimed
    uint256 public totalPendingClaims;

    // Events
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event ClaimApproved(address indexed user, uint256 amount);
    event ClaimRevoked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event Deposited(address indexed admin, uint256 amount);
    event Withdrawn(address indexed admin, uint256 amount);

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

    // ============ ADMIN FUNCTIONS ============

    /// @notice Add a new admin
    function addAdmin(address _admin) external onlyAdmin {
        require(!isAdmin[_admin], "Already admin");
        isAdmin[_admin] = true;
        emit AdminAdded(_admin);
    }

    /// @notice Remove an admin (cannot remove self)
    function removeAdmin(address _admin) external onlyAdmin {
        require(_admin != msg.sender, "Cannot remove self");
        require(isAdmin[_admin], "Not admin");
        isAdmin[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /// @notice Deposit USDC into the contract for claims
    /// @dev Caller must have approved this contract to spend USDC
    function deposit(uint256 _amount) external onlyAdmin {
        require(_amount > 0, "Amount must be > 0");
        USDC.safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposited(msg.sender, _amount);
    }

    /// @notice Withdraw excess USDC (only amount above pending claims)
    function withdrawExcess(uint256 _amount) external onlyAdmin {
        uint256 balance = USDC.balanceOf(address(this));
        uint256 excess = balance > totalPendingClaims ? balance - totalPendingClaims : 0;
        require(_amount <= excess, "Cannot withdraw pending claims");
        USDC.safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    /// @notice Emergency withdraw all (only if no pending claims)
    function emergencyWithdraw() external onlyAdmin {
        require(totalPendingClaims == 0, "Has pending claims");
        uint256 balance = USDC.balanceOf(address(this));
        if (balance > 0) {
            USDC.safeTransfer(msg.sender, balance);
            emit Withdrawn(msg.sender, balance);
        }
    }

    /// @notice Approve a single user's claim amount
    /// @param _user User address
    /// @param _amount Amount in USDC (6 decimals)
    function approveClaim(address _user, uint256 _amount) external onlyAdmin {
        require(_user != address(0), "Invalid user");

        // Update totals
        totalPendingClaims = totalPendingClaims - claimableAmount[_user] + _amount;

        // Ensure we have enough balance
        require(USDC.balanceOf(address(this)) >= totalPendingClaims, "Insufficient balance");

        claimableAmount[_user] = _amount;
        emit ClaimApproved(_user, _amount);
    }

    /// @notice Batch approve multiple claims
    /// @param _users Array of user addresses
    /// @param _amounts Array of amounts (6 decimals)
    function batchApproveClaims(
        address[] calldata _users,
        uint256[] calldata _amounts
    ) external onlyAdmin {
        require(_users.length == _amounts.length, "Length mismatch");

        uint256 newTotal = totalPendingClaims;

        for (uint i = 0; i < _users.length; i++) {
            require(_users[i] != address(0), "Invalid user");
            newTotal = newTotal - claimableAmount[_users[i]] + _amounts[i];
            claimableAmount[_users[i]] = _amounts[i];
            emit ClaimApproved(_users[i], _amounts[i]);
        }

        require(USDC.balanceOf(address(this)) >= newTotal, "Insufficient balance");
        totalPendingClaims = newTotal;
    }

    /// @notice Revoke a user's pending claim
    function revokeClaim(address _user) external onlyAdmin {
        uint256 amount = claimableAmount[_user];
        require(amount > 0, "No claim to revoke");

        totalPendingClaims -= amount;
        claimableAmount[_user] = 0;
        emit ClaimRevoked(_user, amount);
    }

    // ============ USER FUNCTIONS ============

    /// @notice Claim your approved USDC
    function claim() external nonReentrant {
        uint256 amount = claimableAmount[msg.sender];
        require(amount > 0, "Nothing to claim");

        // Clear before transfer (CEI pattern)
        claimableAmount[msg.sender] = 0;
        totalPendingClaims -= amount;

        // Transfer USDC to user
        USDC.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }

    // ============ VIEW FUNCTIONS ============

    /// @notice Get contract USDC balance
    function getBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }

    /// @notice Get available (non-pending) balance
    function getAvailableBalance() external view returns (uint256) {
        uint256 balance = USDC.balanceOf(address(this));
        return balance > totalPendingClaims ? balance - totalPendingClaims : 0;
    }

    /// @notice Check if user has a pending claim
    function hasClaim(address _user) external view returns (bool) {
        return claimableAmount[_user] > 0;
    }
}
