// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ClawnchRewards — Dual-Token Staking (Stake CLAWNCH, Earn INCLAWNCH)
/// @notice Stake $CLAWNCH, earn $inCLAWNCH. Admin deposits INCLAWNCH rewards with
///         a duration and the contract drips them proportionally to all stakers.
///         Synthetix StakingRewards model. No lock. No rug.
///         UUPS upgradeable — admin can push fixes until renounceUpgradeability().
contract ClawnchRewards is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    IERC20 public stakingToken;   // CLAWNCH — users stake this
    IERC20 public rewardToken;    // INCLAWNCH — users earn this
    address public admin;

    // Reward drip (Synthetix model)
    uint256 public rewardRate;              // rewardToken per second
    uint256 public periodEnd;               // when current drip ends
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    // Staking
    uint256 public totalStaked;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) private _userRewardPerTokenPaid;
    mapping(address => uint256) private _rewards;

    // Migration
    bool public migrationOpen;

    // Stats
    uint256 public totalRewardsDeposited;
    uint256 public totalRewardsClaimed;
    uint256 public stakerCount;

    // Upgrade lock
    bool public upgradeRenounced;

    // Reserve storage slots for future upgrades (UUPS best practice)
    uint256[50] private __gap;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(uint256 amount, uint256 duration, uint256 newRate);
    event MigrationFinalized();
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event UpgradeRenounced(address indexed admin);

    // ══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
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
    //  INITIALIZER (replaces constructor for UUPS proxy)
    // ══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stakingToken, address _rewardToken, address _admin) external initializer {
        require(_stakingToken != address(0), "zero staking token");
        require(_rewardToken != address(0), "zero reward token");
        require(_admin != address(0), "zero admin");

        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        admin = _admin;
        migrationOpen = true;
    }

    // ══════════════════════════════════════════════════════════════
    //  UUPS UPGRADE CONTROL
    // ══════════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal view override {
        require(msg.sender == admin, "not admin");
        require(!upgradeRenounced, "upgrades renounced");
    }

    /// @notice Permanently lock the contract — no more upgrades ever.
    function renounceUpgradeability() external onlyAdmin {
        upgradeRenounced = true;
        emit UpgradeRenounced(msg.sender);
    }

    /// @notice Contract version — bump on each upgrade to confirm it took.
    function version() external pure returns (uint256) {
        return 1;
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

    /// @notice Seconds until current reward period ends. 0 if expired.
    function timeUntilPeriodEnd() external view returns (uint256) {
        if (block.timestamp >= periodEnd) return 0;
        return periodEnd - block.timestamp;
    }

    /// @notice Reward tokens remaining in reward pool (undistributed).
    function rewardPoolBalance() external view returns (uint256) {
        if (block.timestamp >= periodEnd) return 0;
        return (periodEnd - block.timestamp) * rewardRate;
    }

    // ══════════════════════════════════════════════════════════════
    //  USER ACTIONS
    // ══════════════════════════════════════════════════════════════

    /// @notice Stake CLAWNCH. Requires prior ERC-20 approval.
    function stake(uint256 amount) external whenNotPaused nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero amount");

        if (balanceOf[msg.sender] == 0) stakerCount++;

        totalStaked += amount;
        balanceOf[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, amount);
    }

    /// @notice Unstake CLAWNCH. Always allowed, even when paused.
    function unstake(uint256 amount) external nonReentrant updateReward(msg.sender) {
        require(amount > 0, "zero amount");
        require(balanceOf[msg.sender] >= amount, "insufficient stake");

        totalStaked -= amount;
        balanceOf[msg.sender] -= amount;

        if (balanceOf[msg.sender] == 0) stakerCount--;

        stakingToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    /// @notice Claim accrued INCLAWNCH rewards.
    function claim() public nonReentrant updateReward(msg.sender) {
        uint256 reward = _rewards[msg.sender];
        if (reward == 0) return;

        _rewards[msg.sender] = 0;
        totalRewardsClaimed += reward;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    /// @notice Unstake all CLAWNCH and claim all INCLAWNCH rewards in one tx.
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

    /// @notice Deposit INCLAWNCH rewards to drip over `duration` seconds.
    ///         If called before the current period ends, leftover rolls into
    ///         the new period — nothing is wasted.
    /// @param amount   INCLAWNCH to add to the reward pool.
    /// @param duration Seconds over which to distribute (e.g. 2592000 = 30 days).
    function depositRewards(uint256 amount, uint256 duration)
        external
        onlyAdmin
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
    //  ADMIN — CONTROLS
    // ══════════════════════════════════════════════════════════════

    /// @notice Pause new stakes (unstake + claim always allowed).
    function pause() external onlyAdmin { _pause(); }

    /// @notice Unpause staking.
    function unpause() external onlyAdmin { _unpause(); }

    /// @notice Rescue tokens accidentally sent to contract.
    ///         Cannot touch the staking token OR the reward token.
    function recoverToken(address token) external onlyAdmin {
        require(token != address(stakingToken), "cannot recover staking token");
        require(token != address(rewardToken), "cannot recover reward token");
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    /// @notice Transfer admin role.
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ══════════════════════════════════════════════════════════════
    //  MIGRATION (one-time)
    // ══════════════════════════════════════════════════════════════

    /// @notice Stake on behalf of a user during migration. Admin must have
    ///         approved the contract to spend their CLAWNCH first.
    ///         Disabled permanently after finalizeMigration().
    function stakeFor(address user, uint256 amount)
        external
        onlyAdmin
        whenNotPaused
        nonReentrant
        updateReward(user)
    {
        require(migrationOpen, "migration closed");
        require(user != address(0), "zero address");
        require(amount > 0, "zero amount");

        if (balanceOf[user] == 0) stakerCount++;

        totalStaked += amount;
        balanceOf[user] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(user, amount);
    }

    /// @notice Permanently disable stakeFor(). Cannot be undone.
    function finalizeMigration() external onlyAdmin {
        migrationOpen = false;
        emit MigrationFinalized();
    }

    // ══════════════════════════════════════════════════════════════
    //  EMERGENCY
    // ══════════════════════════════════════════════════════════════

    /// @notice Pull your staked CLAWNCH without touching reward math.
    ///         Use only if reward accounting is broken (e.g. bad upgrade).
    ///         Forfeits any unclaimed INCLAWNCH rewards.
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
