// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ISuiteStaking
 * @dev Interface for SuiteStaking contract — reads credit balances
 */
interface ISuiteStaking {
    function stakedBalance(address user) external view returns (uint256);
    function bonusCredits(address user) external view returns (uint256);
    function totalBonusCredits() external view returns (uint256);
    function totalCredits(address user) external view returns (uint256);
}

/**
 * @title StakingRewards
 * @dev Distribute USDC rewards proportional to ALL credits (staked + bonus)
 *
 * Two parties:
 * 1. Depositors — anyone calls depositRewards() to fund the pool
 * 2. Credit holders — call claimUsdc() to withdraw their earned share
 *
 * Distribution is proportional to totalCredits (staked + bonus), not just staked SUITE.
 * Based on Synthetix StakingRewards pattern.
 */
contract StakingRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public usdc;                  // Reward token (USDC)
    IERC20 public suiteToken;            // For reading total staked SUITE
    ISuiteStaking public stakingContract; // SuiteStaking — source of credit balances

    uint256 public rewardRate;           // USDC rewards per second (6 decimals)
    uint256 public rewardsDuration = 30 days;
    uint256 public periodFinish;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards; // In USDC (6 decimals)

    // ============ Events ============

    event RewardAdded(uint256 reward, address indexed depositor);
    event RewardClaimedAsUsdc(address indexed user, uint256 amount);
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
     * @dev Total credits across all users (staked SUITE + all bonus credits)
     * This is the denominator for reward distribution
     */
    function totalCredits() public view returns (uint256) {
        return suiteToken.balanceOf(address(stakingContract)) + stakingContract.totalBonusCredits();
    }

    /**
     * @dev A user's total credits (staked + bonus)
     * This is the user's weight in the reward distribution
     */
    function userCredits(address user) public view returns (uint256) {
        return stakingContract.totalCredits(user);
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     * @dev Reward per credit (scaled by 1e18 for precision)
     */
    function rewardPerToken() public view returns (uint256) {
        uint256 _totalCredits = totalCredits();
        if (_totalCredits == 0) {
            return rewardPerTokenStored;
        }
        return rewardPerTokenStored + (
            (lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18 / _totalCredits
        );
    }

    /**
     * @dev Calculate earned USDC rewards for a user based on their credits
     */
    function earned(address user) public view returns (uint256) {
        return (
            userCredits(user) * (rewardPerToken() - userRewardPerTokenPaid[user]) / 1e18
        ) + rewards[user];
    }

    /**
     * @dev Get total USDC reward for the full current period
     */
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    // ============ User Functions ============

    /**
     * @dev Claim rewards as raw USDC
     * Any credit holder can call this to withdraw their earned share
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
     * @dev Deposit USDC rewards to be distributed to all credit holders
     * Anyone can call — treasury, community members, external parties
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
