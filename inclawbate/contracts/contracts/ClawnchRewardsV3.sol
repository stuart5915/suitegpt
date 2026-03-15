// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ClawnchRewardsV3 — Non-UUPS Staking (for EIP-1167 Clones)
/// @notice Same Synthetix StakingRewards logic as ClawnchRewardsLite, with
///         multi-depositor support. Authorized depositors can call depositRewards
///         without being admin. Designed for EIP-1167 minimal proxy via StakingFactory.
contract ClawnchRewardsV3 is
    Initializable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    IERC20 public stakingToken;
    IERC20 public rewardToken;
    address public admin;

    uint256 public rewardRate;
    uint256 public periodEnd;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    uint256 public totalStaked;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) private _userRewardPerTokenPaid;
    mapping(address => uint256) private _rewards;

    uint256 public totalRewardsDeposited;
    uint256 public totalRewardsClaimed;
    uint256 public stakerCount;

    mapping(address => bool) public rewardDepositors;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(uint256 amount, uint256 duration, uint256 newRate);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event RewardDepositorGranted(address indexed depositor);
    event RewardDepositorRevoked(address indexed depositor);

    // ══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    modifier onlyDepositor() {
        require(msg.sender == admin || rewardDepositors[msg.sender], "not depositor");
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

    // ══════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ══════════════════════════════════════════════════════════════

    function initialize(address _stakingToken, address _rewardToken, address _admin) external initializer {
        require(_stakingToken != address(0), "zero staking token");
        require(_rewardToken != address(0), "zero reward token");
        require(_admin != address(0), "zero admin");

        __ReentrancyGuard_init();
        __Pausable_init();

        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        admin = _admin;
        rewardDepositors[_admin] = true;
    }

    /// @notice Initialize with an extra depositor (called by StakingFactoryV3)
    function initializeWithDepositor(
        address _stakingToken,
        address _rewardToken,
        address _admin,
        address _depositor
    ) external initializer {
        require(_stakingToken != address(0), "zero staking token");
        require(_rewardToken != address(0), "zero reward token");
        require(_admin != address(0), "zero admin");

        __ReentrancyGuard_init();
        __Pausable_init();

        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        admin = _admin;
        rewardDepositors[_admin] = true;
        if (_depositor != address(0)) {
            rewardDepositors[_depositor] = true;
            emit RewardDepositorGranted(_depositor);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

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

    function timeUntilPeriodEnd() external view returns (uint256) {
        if (block.timestamp >= periodEnd) return 0;
        return periodEnd - block.timestamp;
    }

    function rewardPoolBalance() external view returns (uint256) {
        if (block.timestamp >= periodEnd) return 0;
        return (periodEnd - block.timestamp) * rewardRate;
    }

    // ══════════════════════════════════════════════════════════════
    //  USER ACTIONS
    // ══════════════════════════════════════════════════════════════

    function stake(uint256 amount) external whenNotPaused nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero amount");
        if (balanceOf[msg.sender] == 0) stakerCount++;
        totalStaked += amount;
        balanceOf[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero amount");
        require(balanceOf[msg.sender] >= amount, "insufficient stake");
        totalStaked -= amount;
        balanceOf[msg.sender] -= amount;
        if (balanceOf[msg.sender] == 0) stakerCount--;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() public nonReentrant updateReward(msg.sender) {
        uint256 reward = _rewards[msg.sender];
        if (reward == 0) return;
        _rewards[msg.sender] = 0;
        totalRewardsClaimed += reward;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    function exit() external nonReentrant updateReward(msg.sender) {
        uint256 stakedAmount = balanceOf[msg.sender];
        uint256 reward = _rewards[msg.sender];

        if (stakedAmount > 0) {
            totalStaked -= stakedAmount;
            balanceOf[msg.sender] = 0;
            stakerCount--;
            stakingToken.safeTransfer(msg.sender, stakedAmount);
            emit Unstaked(msg.sender, stakedAmount);
        }

        if (reward > 0) {
            _rewards[msg.sender] = 0;
            totalRewardsClaimed += reward;
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardClaimed(msg.sender, reward);
        }
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — REWARD FUNDING
    // ══════════════════════════════════════════════════════════════

    function depositRewards(uint256 amount, uint256 duration)
        external
        onlyDepositor
        updateReward(address(0))
    {
        require(duration > 0, "zero duration");
        require(amount > 0, "zero amount");

        rewardToken.safeTransferFrom(msg.sender, address(this), amount);

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

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — DEPOSITOR MANAGEMENT
    // ══════════════════════════════════════════════════════════════

    function grantRewardDepositor(address depositor) external onlyAdmin {
        rewardDepositors[depositor] = true;
        emit RewardDepositorGranted(depositor);
    }

    function revokeRewardDepositor(address depositor) external onlyAdmin {
        rewardDepositors[depositor] = false;
        emit RewardDepositorRevoked(depositor);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — CONTROLS
    // ══════════════════════════════════════════════════════════════

    function pause() external onlyAdmin { _pause(); }
    function unpause() external onlyAdmin { _unpause(); }

    function recoverToken(address token) external onlyAdmin {
        require(token != address(stakingToken), "cannot recover staking token");
        require(token != address(rewardToken), "cannot recover reward token");
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ══════════════════════════════════════════════════════════════
    //  EMERGENCY
    // ══════════════════════════════════════════════════════════════

    function emergencyWithdraw() external nonReentrant {
        uint256 amount = balanceOf[msg.sender];
        require(amount > 0, "nothing staked");
        totalStaked -= amount;
        balanceOf[msg.sender] = 0;
        _rewards[msg.sender] = 0;
        stakerCount--;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }
}
