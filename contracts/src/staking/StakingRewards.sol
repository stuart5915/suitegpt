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
    function stakedBalance(address user) external view returns (uint256);
    function buyAndStakeFor(address user, uint256 usdcAmount) external;
}

/**
 * @title StakingRewards
 * @dev Distribute USDC rewards to SUITE stakers
 *
 * Two claim options:
 * 1. claimAndCompound() - Converts USDC rewards to more credits (default for normies)
 * 2. claimUsdc() - Withdraws raw USDC (for advanced/crypto users)
 *
 * Based on Synthetix StakingRewards pattern.
 */
contract StakingRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public usdc;                  // Reward token (USDC)
    IERC20 public suiteToken;            // For reading total staked
    ISuiteStaking public stakingContract; // SuiteStaking contract

    uint256 public rewardRate;           // USDC rewards per second (6 decimals)
    uint256 public rewardsDuration = 7 days;
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards; // In USDC (6 decimals)

    // ============ Events ============

    event RewardAdded(uint256 reward, address indexed depositor);
    event RewardClaimedAsUsdc(address indexed user, uint256 amount);
    event RewardCompounded(address indexed user, uint256 usdcAmount, uint256 creditsAdded);
    event RewardsDurationUpdated(uint256 newDuration);

    // ============ Errors ============

    error ZeroAddress();
    error ZeroAmount();
    error RewardPeriodNotFinished();
    error RewardTooHigh();
    error NoRewardsToClaim();

    // ============ Constructor ============

    constructor(
        address _usdc,
        address _suiteToken,
        address _stakingContract,
        address _owner
    ) Ownable(_owner) {
        if (_usdc == address(0) || _suiteToken == address(0) || _stakingContract == address(0)) {
            revert ZeroAddress();
        }
        usdc = IERC20(_usdc);
        suiteToken = IERC20(_suiteToken);
        stakingContract = ISuiteStaking(_stakingContract);
    }

    // ============ Views ============

    /**
     * @dev Get total SUITE staked in staking contract
     */
    function totalStaked() public view returns (uint256) {
        return suiteToken.balanceOf(address(stakingContract));
    }

    /**
     * @dev Get user's staked balance
     */
    function stakedBalance(address user) public view returns (uint256) {
        return stakingContract.stakedBalance(user);
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     * @dev Reward per token (scaled by 1e18 for precision, result in USDC per SUITE)
     */
    function rewardPerToken() public view returns (uint256) {
        uint256 _totalStaked = totalStaked();
        if (_totalStaked == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (
            (lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / _totalStaked
        );
    }

    /**
     * @dev Calculate earned USDC rewards for a user
     */
    function earned(address user) public view returns (uint256) {
        return (
            stakedBalance(user) * (rewardPerToken() - userRewardPerTokenPaid[user]) / 1e18
        ) + rewards[user];
    }

    /**
     * @dev Get reward for full duration
     */
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    // ============ User Functions ============

    /**
     * @dev Claim rewards and auto-compound into more credits (DEFAULT)
     * Converts USDC rewards → buys more SUITE → stakes for credits
     */
    function claimAndCompound() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) revert NoRewardsToClaim();

        rewards[msg.sender] = 0;

        // Approve staking contract to spend USDC
        usdc.approve(address(stakingContract), reward);

        // Buy and stake on behalf of user
        stakingContract.buyAndStakeFor(msg.sender, reward);

        // Calculate credits added (reward * 1000 SUITE per USDC * 1e12 for decimals)
        uint256 creditsAdded = reward * 1000 * 1e12;

        emit RewardCompounded(msg.sender, reward, creditsAdded);
    }

    /**
     * @dev Claim rewards as raw USDC (ADVANCED)
     * For crypto users who want to withdraw
     */
    function claimUsdc() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) revert NoRewardsToClaim();

        rewards[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, reward);

        emit RewardClaimedAsUsdc(msg.sender, reward);
    }

    // ============ Deposit Functions ============

    /**
     * @dev Deposit USDC rewards to be distributed
     * Anyone can call - treasury, community, etc.
     */
    function depositRewards(uint256 amount) external nonReentrant updateReward(address(0)) {
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            rewardRate = amount / rewardsDuration;
        } else {
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / rewardsDuration;
        }

        // Sanity check
        uint256 balance = usdc.balanceOf(address(this));
        if (rewardRate > balance / rewardsDuration) {
            revert RewardTooHigh();
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;

        emit RewardAdded(amount, msg.sender);
    }

    // ============ Admin Functions ============

    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        if (block.timestamp < periodFinish) {
            revert RewardPeriodNotFinished();
        }
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsDuration);
    }

    function setStakingContract(address _stakingContract) external onlyOwner {
        if (_stakingContract == address(0)) revert ZeroAddress();
        stakingContract = ISuiteStaking(_stakingContract);
    }

    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(usdc), "Cannot withdraw reward token");
        IERC20(tokenAddress).safeTransfer(owner(), tokenAmount);
    }

    // ============ Modifiers ============

    modifier updateReward(address user) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (user != address(0)) {
            rewards[user] = earned(user);
            userRewardPerTokenPaid[user] = rewardPerTokenStored;
        }
        _;
    }
}
