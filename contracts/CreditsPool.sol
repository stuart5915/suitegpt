// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CreditsPool
 * @notice One-way SUITE → Credits conversion for SUITE ecosystem
 * @dev SUITE tokens transferred here are locked and converted to off-chain credits
 */
contract CreditsPool is Ownable, ReentrancyGuard {
    IERC20 public immutable suiteToken;
    
    // Events for off-chain tracking (Supabase webhook)
    event CreditsLoaded(
        address indexed user, 
        uint256 amount, 
        string discordId,
        uint256 timestamp
    );
    event CreditsDistributed(address indexed creator, uint256 amount);
    event SuiteBurned(uint256 amount);
    
    // Analytics
    uint256 public totalCreditsLoaded;
    uint256 public totalDistributed;
    uint256 public totalBurned;
    
    // Dead address for burns
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    constructor(address _suiteToken) Ownable(msg.sender) {
        require(_suiteToken != address(0), "Invalid token address");
        suiteToken = IERC20(_suiteToken);
    }
    
    /**
     * @notice Load credits by transferring SUITE (one-way, non-refundable)
     * @param amount Amount of SUITE to convert to credits (1 SUITE = 1 credit)
     * @param discordId User's Discord ID for off-chain credit mapping
     */
    function loadCredits(uint256 amount, string calldata discordId) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(bytes(discordId).length > 0, "Discord ID required");
        require(bytes(discordId).length <= 32, "Discord ID too long");
        
        // Transfer SUITE from user to this contract
        // Reverts if user hasn't approved or insufficient balance
        bool success = suiteToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        totalCreditsLoaded += amount;
        
        // Emit event - Supabase webhook listens for this
        emit CreditsLoaded(msg.sender, amount, discordId, block.timestamp);
    }
    
    /**
     * @notice Distribute accumulated SUITE to creators (revenue share)
     * @param creator Creator wallet address
     * @param amount Amount to distribute
     */
    function distributeToCreator(address creator, uint256 amount) external onlyOwner nonReentrant {
        require(creator != address(0), "Invalid creator address");
        require(amount > 0, "Amount must be > 0");
        require(suiteToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        bool success = suiteToken.transfer(creator, amount);
        require(success, "Transfer failed");
        
        totalDistributed += amount;
        emit CreditsDistributed(creator, amount);
    }
    
    /**
     * @notice Burn accumulated SUITE (deflationary mechanism)
     * @param amount Amount to burn
     */
    function burnSuite(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(suiteToken.balanceOf(address(this)) >= amount, "Insufficient balance");
        
        bool success = suiteToken.transfer(DEAD_ADDRESS, amount);
        require(success, "Transfer failed");
        
        totalBurned += amount;
        emit SuiteBurned(amount);
    }
    
    /**
     * @notice Get contract SUITE balance (available for distribution/burn)
     */
    function getBalance() external view returns (uint256) {
        return suiteToken.balanceOf(address(this));
    }
    
    /**
     * @notice Get pool statistics
     */
    function getStats() external view returns (
        uint256 balance,
        uint256 loaded,
        uint256 distributed,
        uint256 burned
    ) {
        return (
            suiteToken.balanceOf(address(this)),
            totalCreditsLoaded,
            totalDistributed,
            totalBurned
        );
    }
}
