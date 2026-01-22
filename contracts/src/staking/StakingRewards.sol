// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingRewards
 * @dev Distribute rewards to SUITE stakers proportionally
 *
 * Based on Synthetix StakingRewards pattern:
 * - Anyone can deposit SUITE rewards
 * - Rewards distributed over time to stakers
 * - Stakers claim proportional to their stake
 *
 * Integration:
 * - Reads staked balances from SuiteStaking contract
 * - Rewards paid in SUITE tokens
 */
contract StakingRewards is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    IERC20 public rewardToken;          // SUITE token
    address public stakingContract;      // SuiteStaking contract address

    uint256 public rewardRate;           // Rewards per second
    uint256 public rewardsDuration = 7 days;  // Default reward period
    uint256 public periodFinish;         // When current reward period ends
    uint256 public lastUpdateTime;       // Last time rewards were calculated
    uint256 public rewardPerTokenStored; // Accumulated rewards per token

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    // ============ Events ============

    event RewardAdded(uint256 reward, address indexed depositor);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardsDurationUpdated(uint256 newDuration);
    event StakingContractUpdated(address indexed newContract);

    // ============ Errors ============

    error ZeroAddress();
    error ZeroAmount();
    error RewardPeriodNotFinished();
    error RewardTooHigh();

    // ============ Constructor ============

    constructor(
        address _rewardToken,
        address _stakingContract,
        address _owner
    ) Ownable(_owner) {
        if (_rewardToken == address(0) || _stakingContract == address(0)) {
            revert ZeroAddress();
        }
        rewardToken = IERC20(_rewardToken);
        stakingContract = _stakingContract;
    }

    // ============ Views ============

    /**
     * @dev Get total staked from SuiteStaking contract
     */
    function totalStaked() public view returns (uint256) {
        return rewardToken.balanceOf(stakingContract);
    }

    /**
     * @dev Get user's staked balance from SuiteStaking contract
     */
    function stakedBalance(address user) public view returns (uint256) {
        // Call stakedBalance on SuiteStaking
        (bool success, bytes memory data) = stakingContract.staticcall(
            abi.encodeWithSignature("stakedBalance(address)", user)
        );
        if (success && data.length >= 32) {
            return abi.decode(data, (uint256));
        }
        return 0;
    }

    /**
     * @dev Returns the last time rewards are applicable
     */
    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    /**
     * @dev Calculate reward per token
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
     * @dev Calculate earned rewards for a user
     */
    function earned(address user) public view returns (uint256) {
        return (
            stakedBalance(user) * (rewardPerToken() - userRewardPerTokenPaid[user]) / 1e18
        ) + rewards[user];
    }

    /**
     * @dev Get reward for the full duration
     */
    function getRewardForDuration() external view returns (uint256) {
        return rewardRate * rewardsDuration;
    }

    // ============ Mutative Functions ============

    /**
     * @dev Claim pending rewards
     */
    function claimReward() external nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /**
     * @dev Deposit rewards to be distributed
     * Anyone can call this - treasury, community members, etc.
     * @param amount Amount of SUITE to add as rewards
     */
    function depositRewards(uint256 amount) external nonReentrant updateReward(address(0)) {
        if (amount == 0) revert ZeroAmount();

        // Transfer reward tokens from sender
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

        if (block.timestamp >= periodFinish) {
            // Start new reward period
            rewardRate = amount / rewardsDuration;
        } else {
            // Add to existing reward period
            uint256 remaining = periodFinish - block.timestamp;
            uint256 leftover = remaining * rewardRate;
            rewardRate = (amount + leftover) / rewardsDuration;
        }

        // Ensure reward rate is not too high (prevents overflow)
        uint256 balance = rewardToken.balanceOf(address(this));
        if (rewardRate > balance / rewardsDuration) {
            revert RewardTooHigh();
        }

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;

        emit RewardAdded(amount, msg.sender);
    }

    // ============ Admin Functions ============

    /**
     * @dev Update rewards duration (only when no active period)
     */
    function setRewardsDuration(uint256 _rewardsDuration) external onlyOwner {
        if (block.timestamp < periodFinish) {
            revert RewardPeriodNotFinished();
        }
        rewardsDuration = _rewardsDuration;
        emit RewardsDurationUpdated(_rewardsDuration);
    }

    /**
     * @dev Update staking contract address
     */
    function setStakingContract(address _stakingContract) external onlyOwner {
        if (_stakingContract == address(0)) revert ZeroAddress();
        stakingContract = _stakingContract;
        emit StakingContractUpdated(_stakingContract);
    }

    /**
     * @dev Recover accidentally sent tokens (not reward token)
     */
    function recoverERC20(address tokenAddress, uint256 tokenAmount) external onlyOwner {
        require(tokenAddress != address(rewardToken), "Cannot withdraw reward token");
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
