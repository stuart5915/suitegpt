// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AppStaking
 * @dev Stake SUITE tokens and allocate "power" to apps to unlock development tiers.
 * 
 * Key Features:
 * - Stake SUITE tokens (no lock required)
 * - Allocate staking power to specific apps
 * - Apps unlock tiers based on total allocated power
 * - Free reallocation between apps
 * - Withdraw anytime
 * 
 * Tier Thresholds (configurable):
 * - Tier 1: 10,000 SUITE ($10) - Weekly bug fixes
 * - Tier 2: 50,000 SUITE ($50) - 2 features/week
 * - Tier 3: 200,000 SUITE ($200) - Marketing loops
 * - Tier 4: 500,000 SUITE ($500) - Human QA/design
 * - Tier 5: 1,000,000 SUITE ($1,000) - Full product team
 */
contract AppStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    IERC20 public suiteToken;
    
    // Tier thresholds (in SUITE tokens, 18 decimals)
    uint256[] public tierThresholds;
    
    // User staking data
    struct UserStake {
        uint256 totalStaked;        // Total SUITE staked by user
        uint256 unallocatedPower;   // Power not yet allocated to any app
    }
    
    mapping(address => UserStake) public userStakes;
    
    // App allocation data
    // appId => total power allocated to this app
    mapping(bytes32 => uint256) public appTotalPower;
    
    // User allocations: user => appId => power allocated
    mapping(address => mapping(bytes32 => uint256)) public userAllocations;
    
    // Track all apps a user has allocated to (for enumeration)
    mapping(address => bytes32[]) private userAppList;
    mapping(address => mapping(bytes32 => bool)) private userHasApp;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event PowerAllocated(address indexed user, bytes32 indexed appId, uint256 amount);
    event PowerDeallocated(address indexed user, bytes32 indexed appId, uint256 amount);
    event TierThresholdsUpdated(uint256[] newThresholds);
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    constructor(
        address _suiteToken,
        address _owner
    ) Ownable(_owner) {
        suiteToken = IERC20(_suiteToken);
        
        // Default tier thresholds (18 decimals)
        tierThresholds = new uint256[](5);
        tierThresholds[0] = 10_000 * 1e18;      // Tier 1: 10k SUITE
        tierThresholds[1] = 50_000 * 1e18;      // Tier 2: 50k SUITE
        tierThresholds[2] = 200_000 * 1e18;     // Tier 3: 200k SUITE
        tierThresholds[3] = 500_000 * 1e18;     // Tier 4: 500k SUITE
        tierThresholds[4] = 1_000_000 * 1e18;   // Tier 5: 1M SUITE
    }
    
    // ============================================
    // STAKING FUNCTIONS
    // ============================================
    
    /**
     * @dev Stake SUITE tokens to gain staking power
     * @param amount Amount of SUITE to stake (18 decimals)
     */
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        // Transfer SUITE from user
        suiteToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Update user stake
        userStakes[msg.sender].totalStaked += amount;
        userStakes[msg.sender].unallocatedPower += amount;
        
        emit Staked(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw staked SUITE tokens
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userStakes[msg.sender].unallocatedPower >= amount, "Insufficient unallocated power");
        require(userStakes[msg.sender].totalStaked >= amount, "Insufficient stake");
        
        // Update user stake
        userStakes[msg.sender].totalStaked -= amount;
        userStakes[msg.sender].unallocatedPower -= amount;
        
        // Transfer SUITE back to user
        suiteToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
    
    // ============================================
    // ALLOCATION FUNCTIONS
    // ============================================
    
    /**
     * @dev Allocate staking power to an app
     * @param appId The app identifier (keccak256 of app slug)
     * @param amount Amount of power to allocate
     */
    function allocate(bytes32 appId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userStakes[msg.sender].unallocatedPower >= amount, "Insufficient unallocated power");
        
        // Update user allocation
        userStakes[msg.sender].unallocatedPower -= amount;
        userAllocations[msg.sender][appId] += amount;
        
        // Update app total
        appTotalPower[appId] += amount;
        
        // Track app in user's list (for enumeration)
        if (!userHasApp[msg.sender][appId]) {
            userAppList[msg.sender].push(appId);
            userHasApp[msg.sender][appId] = true;
        }
        
        emit PowerAllocated(msg.sender, appId, amount);
    }
    
    /**
     * @dev Deallocate staking power from an app
     * @param appId The app identifier
     * @param amount Amount of power to deallocate
     */
    function deallocate(bytes32 appId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userAllocations[msg.sender][appId] >= amount, "Insufficient allocation");
        
        // Update user allocation
        userAllocations[msg.sender][appId] -= amount;
        userStakes[msg.sender].unallocatedPower += amount;
        
        // Update app total
        appTotalPower[appId] -= amount;
        
        emit PowerDeallocated(msg.sender, appId, amount);
    }
    
    /**
     * @dev Move power between two apps in one transaction
     * @param fromAppId The app to take power from
     * @param toAppId The app to give power to
     * @param amount Amount of power to move
     */
    function reallocate(bytes32 fromAppId, bytes32 toAppId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userAllocations[msg.sender][fromAppId] >= amount, "Insufficient allocation");
        
        // Move from source app
        userAllocations[msg.sender][fromAppId] -= amount;
        appTotalPower[fromAppId] -= amount;
        
        // Move to destination app
        userAllocations[msg.sender][toAppId] += amount;
        appTotalPower[toAppId] += amount;
        
        // Track destination app
        if (!userHasApp[msg.sender][toAppId]) {
            userAppList[msg.sender].push(toAppId);
            userHasApp[msg.sender][toAppId] = true;
        }
        
        emit PowerDeallocated(msg.sender, fromAppId, amount);
        emit PowerAllocated(msg.sender, toAppId, amount);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @dev Get the current tier of an app (0-5)
     * @param appId The app identifier
     * @return tier The current tier (0 = no tier, 1-5 = active tiers)
     */
    function getAppTier(bytes32 appId) external view returns (uint256 tier) {
        uint256 totalPower = appTotalPower[appId];
        
        // Check thresholds from highest to lowest
        for (uint256 i = tierThresholds.length; i > 0; i--) {
            if (totalPower >= tierThresholds[i - 1]) {
                return i;
            }
        }
        return 0;
    }
    
    /**
     * @dev Get progress to next tier
     * @param appId The app identifier
     * @return currentTier Current tier level
     * @return currentPower Total power allocated
     * @return nextThreshold Power needed for next tier (0 if max tier)
     * @return progressBps Progress to next tier in basis points (0-10000)
     */
    function getAppProgress(bytes32 appId) external view returns (
        uint256 currentTier,
        uint256 currentPower,
        uint256 nextThreshold,
        uint256 progressBps
    ) {
        currentPower = appTotalPower[appId];
        
        // Find current tier
        for (uint256 i = tierThresholds.length; i > 0; i--) {
            if (currentPower >= tierThresholds[i - 1]) {
                currentTier = i;
                break;
            }
        }
        
        // Calculate progress to next tier
        if (currentTier >= tierThresholds.length) {
            // Max tier reached
            nextThreshold = 0;
            progressBps = 10000; // 100%
        } else {
            nextThreshold = tierThresholds[currentTier];
            uint256 prevThreshold = currentTier == 0 ? 0 : tierThresholds[currentTier - 1];
            uint256 tierRange = nextThreshold - prevThreshold;
            uint256 tierProgress = currentPower - prevThreshold;
            progressBps = (tierProgress * 10000) / tierRange;
        }
    }
    
    /**
     * @dev Get user's stake info
     */
    function getUserStake(address user) external view returns (
        uint256 totalStaked,
        uint256 unallocatedPower,
        uint256 allocatedPower
    ) {
        totalStaked = userStakes[user].totalStaked;
        unallocatedPower = userStakes[user].unallocatedPower;
        allocatedPower = totalStaked - unallocatedPower;
    }
    
    /**
     * @dev Get user's allocation to a specific app
     */
    function getUserAllocation(address user, bytes32 appId) external view returns (uint256) {
        return userAllocations[user][appId];
    }
    
    /**
     * @dev Get all apps a user has allocated to
     */
    function getUserApps(address user) external view returns (bytes32[] memory) {
        return userAppList[user];
    }
    
    /**
     * @dev Get tier thresholds
     */
    function getTierThresholds() external view returns (uint256[] memory) {
        return tierThresholds;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @dev Update tier thresholds
     * @param newThresholds Array of new thresholds (must be in ascending order)
     */
    function setTierThresholds(uint256[] calldata newThresholds) external onlyOwner {
        require(newThresholds.length > 0, "Must have at least one tier");
        
        // Verify ascending order
        for (uint256 i = 1; i < newThresholds.length; i++) {
            require(newThresholds[i] > newThresholds[i - 1], "Thresholds must be ascending");
        }
        
        tierThresholds = newThresholds;
        emit TierThresholdsUpdated(newThresholds);
    }
    
    /**
     * @dev Emergency withdraw (owner only) - for stuck tokens
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
