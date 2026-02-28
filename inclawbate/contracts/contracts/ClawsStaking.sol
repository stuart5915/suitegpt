// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ClawsStaking — Stake $CLAWS, Earn $CLAWS
/// @notice Synthetix StakingRewards model. No lock. No tiers. Admin deposits
///         rewards with a duration, contract drips them to all stakers.
contract ClawsStaking is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable claws;
    address public admin;

    // Reward drip
    uint256 public rewardRate;
    uint256 public periodEnd;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    // Staking
    uint256 public totalStaked;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) private _userRewardPerTokenPaid;
    mapping(address => uint256) private _rewards;

    // Stats
    uint256 public totalRewardsDeposited;
    uint256 public totalRewardsClaimed;
    uint256 public stakerCount;

    bool public paused;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardCompounded(address indexed user, uint256 amount);
    event RewardsDeposited(uint256 amount, uint256 duration, uint256 newRate);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "paused");
        _;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            _rewards[account] = earned(account);
            _userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    constructor(address _claws) {
        require(_claws != address(0), "zero token");
        claws = IERC20(_claws);
        admin = msg.sender;
    }

    // ── Views ──

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodEnd ? block.timestamp : periodEnd;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return
            (balanceOf[account] * (rewardPerToken() - _userRewardPerTokenPaid[account])) / 1e18
            + _rewards[account];
    }

    function rewardPoolBalance() external view returns (uint256) {
        if (block.timestamp >= periodEnd) return 0;
        return (periodEnd - block.timestamp) * rewardRate;
    }

    // ── User Actions ──

    function stake(uint256 amount) external whenNotPaused nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero amount");
        if (balanceOf[msg.sender] == 0) stakerCount++;
        totalStaked += amount;
        balanceOf[msg.sender] += amount;
        claws.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero amount");
        require(balanceOf[msg.sender] >= amount, "insufficient stake");
        totalStaked -= amount;
        balanceOf[msg.sender] -= amount;
        if (balanceOf[msg.sender] == 0) stakerCount--;
        claws.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() public nonReentrant updateReward(msg.sender) {
        uint256 reward = _rewards[msg.sender];
        if (reward == 0) return;
        _rewards[msg.sender] = 0;
        totalRewardsClaimed += reward;
        claws.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function claimAndRestake() external nonReentrant updateReward(msg.sender) {
        uint256 reward = _rewards[msg.sender];
        require(reward > 0, "nothing to compound");
        _rewards[msg.sender] = 0;
        if (balanceOf[msg.sender] == 0) stakerCount++;
        totalStaked += reward;
        balanceOf[msg.sender] += reward;
        totalRewardsClaimed += reward;
        emit RewardCompounded(msg.sender, reward);
    }

    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 stakedAmount = balanceOf[msg.sender];
        uint256 reward = _rewards[msg.sender];
        if (stakedAmount > 0) {
            totalStaked -= stakedAmount;
            balanceOf[msg.sender] = 0;
            stakerCount--;
            claws.safeTransfer(msg.sender, stakedAmount);
            emit Unstaked(msg.sender, stakedAmount);
        }
        if (reward > 0) {
            _rewards[msg.sender] = 0;
            totalRewardsClaimed += reward;
            claws.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    // ── Admin ──

    function depositRewards(uint256 amount, uint256 duration)
        external onlyAdmin updateReward(address(0))
    {
        require(duration > 0, "zero duration");
        require(amount > 0, "zero amount");
        claws.safeTransferFrom(msg.sender, address(this), amount);
        if (block.timestamp >= periodEnd) {
            rewardRate = amount / duration;
        } else {
            uint256 remaining = (periodEnd - block.timestamp) * rewardRate;
            rewardRate = (remaining + amount) / duration;
        }
        require(rewardRate > 0, "rate too low");
        lastUpdateTime = block.timestamp;
        periodEnd = block.timestamp + duration;
        totalRewardsDeposited += amount;
        emit RewardsDeposited(amount, duration, rewardRate);
    }

    function pause() external onlyAdmin { paused = true; }
    function unpause() external onlyAdmin { paused = false; }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    function recoverToken(address token) external onlyAdmin {
        require(token != address(claws), "cannot recover staking token");
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    function emergencyWithdraw() external nonReentrant {
        uint256 amount = balanceOf[msg.sender];
        require(amount > 0, "nothing staked");
        totalStaked -= amount;
        balanceOf[msg.sender] = 0;
        _rewards[msg.sender] = 0;
        stakerCount--;
        claws.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }
}
