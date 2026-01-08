// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SuiteBridge
 * @dev Bridge contract for transferring SUITE between wallet and Discord balance
 * 
 * SECURITY FEATURES:
 * - Duplicate withdrawal prevention via nonces
 * - Signature verification for withdrawals
 * - Rate limiting (daily withdrawal cap)
 * - Reentrancy protection
 * - Owner-controlled signer address
 */
contract SuiteBridge is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    IERC20 public immutable suiteToken;
    address public signer;
    
    // Rate limiting
    uint256 public dailyWithdrawLimit = 1_000_000 * 10**18; // 1M SUITE per day
    uint256 public currentDayWithdrawn;
    uint256 public lastResetDay;
    
    // Nonce tracking to prevent replay attacks
    mapping(bytes32 => bool) public usedNonces;
    
    // Events for backend listener
    event Deposited(
        address indexed wallet,
        string discordId,
        uint256 amount,
        uint256 timestamp
    );
    
    event Withdrawn(
        address indexed wallet,
        uint256 amount,
        bytes32 nonce,
        uint256 timestamp
    );
    
    event SignerUpdated(address oldSigner, address newSigner);
    event DailyLimitUpdated(uint256 oldLimit, uint256 newLimit);

    constructor(address _suiteToken, address _signer) Ownable(msg.sender) {
        require(_suiteToken != address(0), "Invalid token address");
        require(_signer != address(0), "Invalid signer address");
        
        suiteToken = IERC20(_suiteToken);
        signer = _signer;
        lastResetDay = block.timestamp / 1 days;
    }

    /**
     * @dev Deposit SUITE to credit Discord balance
     * @param discordId The user's Discord ID to credit
     * @param amount Amount of SUITE to deposit (in wei)
     * 
     * Backend listens for Deposited events and credits the Discord balance
     */
    function deposit(string calldata discordId, uint256 amount) external nonReentrant {
        require(bytes(discordId).length > 0, "Invalid Discord ID");
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer SUITE from user to bridge
        require(
            suiteToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        emit Deposited(msg.sender, discordId, amount, block.timestamp);
    }

    /**
     * @dev Withdraw SUITE from Discord balance to wallet
     * @param amount Amount of SUITE to withdraw
     * @param nonce Unique nonce to prevent replay attacks
     * @param signature Backend-signed approval
     * 
     * Backend verifies Discord balance before signing withdrawal approval
     */
    function withdraw(
        uint256 amount,
        bytes32 nonce,
        bytes calldata signature
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(!usedNonces[nonce], "Nonce already used");
        
        // Reset daily limit if new day
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastResetDay) {
            currentDayWithdrawn = 0;
            lastResetDay = currentDay;
        }
        
        // Check daily rate limit
        require(
            currentDayWithdrawn + amount <= dailyWithdrawLimit,
            "Daily withdrawal limit exceeded"
        );
        
        // Verify signature
        bytes32 messageHash = keccak256(
            abi.encodePacked(msg.sender, amount, nonce, block.chainid)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = ethSignedHash.recover(signature);
        
        require(recoveredSigner == signer, "Invalid signature");
        
        // Mark nonce as used
        usedNonces[nonce] = true;
        
        // Update daily withdrawn amount
        currentDayWithdrawn += amount;
        
        // Transfer SUITE to user
        require(
            suiteToken.transfer(msg.sender, amount),
            "Transfer failed"
        );
        
        emit Withdrawn(msg.sender, amount, nonce, block.timestamp);
    }

    /**
     * @dev Check if a nonce has been used
     */
    function isNonceUsed(bytes32 nonce) external view returns (bool) {
        return usedNonces[nonce];
    }

    /**
     * @dev Get remaining daily withdrawal capacity
     */
    function remainingDailyLimit() external view returns (uint256) {
        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastResetDay) {
            return dailyWithdrawLimit;
        }
        return dailyWithdrawLimit - currentDayWithdrawn;
    }

    /**
     * @dev Get bridge's SUITE balance
     */
    function bridgeBalance() external view returns (uint256) {
        return suiteToken.balanceOf(address(this));
    }

    // ========== ADMIN FUNCTIONS ==========

    /**
     * @dev Update the signer address (backend wallet)
     */
    function setSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        emit SignerUpdated(signer, _newSigner);
        signer = _newSigner;
    }

    /**
     * @dev Update daily withdrawal limit
     */
    function setDailyWithdrawLimit(uint256 _newLimit) external onlyOwner {
        emit DailyLimitUpdated(dailyWithdrawLimit, _newLimit);
        dailyWithdrawLimit = _newLimit;
    }

    /**
     * @dev Emergency withdraw in case of issues (owner only)
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(suiteToken.transfer(to, amount), "Transfer failed");
    }
}
