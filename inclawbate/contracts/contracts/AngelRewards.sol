// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AngelRewards — CLAWS rewards for Angel NFT holders
/// @notice Synthetix-style drip. Weight = number of Angel NFTs you hold.
///         Just hold an Angel NFT and claim. Admin can deposit more rewards
///         at any time with any duration — reusable forever.
contract AngelRewards is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable claws;
    IERC721 public immutable angelNFT;

    address public admin;

    // ══════════════════════════════════════════════════════════════
    //  REWARD STATE (Synthetix model)
    // ══════════════════════════════════════════════════════════════

    uint256 public rewardRate;          // CLAWS per second
    uint256 public periodEnd;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    // ══════════════════════════════════════════════════════════════
    //  PARTICIPANT TRACKING
    // ══════════════════════════════════════════════════════════════

    /// @notice Total NFTs registered (sum of all participants' NFT counts)
    uint256 public totalWeight;

    /// @notice Each participant's registered NFT count
    mapping(address => uint256) public weightOf;

    mapping(address => uint256) private _userRewardPerTokenPaid;
    mapping(address => uint256) private _rewards;

    // Stats
    uint256 public totalRewardsDeposited;
    uint256 public totalRewardsClaimed;
    uint256 public participantCount;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event Synced(address indexed user, uint256 oldWeight, uint256 newWeight);
    event RewardClaimed(address indexed user, uint256 amount);
    event RewardsDeposited(uint256 amount, uint256 duration, uint256 newRate);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);

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
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    constructor(address _claws, address _angelNFT) {
        require(_claws != address(0), "zero claws");
        require(_angelNFT != address(0), "zero nft");

        claws = IERC20(_claws);
        angelNFT = IERC721(_angelNFT);
        admin = msg.sender;
    }

    // ══════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodEnd ? block.timestamp : periodEnd;
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalWeight == 0) return rewardPerTokenStored;
        return rewardPerTokenStored +
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalWeight;
    }

    function earned(address account) public view returns (uint256) {
        return
            (weightOf[account] * (rewardPerToken() - _userRewardPerTokenPaid[account])) / 1e18
            + _rewards[account];
    }

    function rewardPoolBalance() external view returns (uint256) {
        if (block.timestamp >= periodEnd) return 0;
        return (periodEnd - block.timestamp) * rewardRate;
    }

    /// @notice Check if an address currently holds an Angel NFT (live, not cached)
    function isAngel(address account) external view returns (bool) {
        return angelNFT.balanceOf(account) > 0;
    }

    /// @notice Check if an address has a stale weight (NFT count changed since last sync)
    function isStale(address account) external view returns (bool) {
        return angelNFT.balanceOf(account) != weightOf[account];
    }

    // ══════════════════════════════════════════════════════════════
    //  USER ACTIONS
    // ══════════════════════════════════════════════════════════════

    /// @notice Register or update your weight. Reads your Angel NFT balance
    ///         on-chain. Call this after buying/selling/transferring an Angel NFT.
    function sync() external nonReentrant updateReward(msg.sender) {
        _syncWeight(msg.sender);
    }

    /// @notice Sync any address. Anyone can call this — prevents stale weights
    ///         after NFT transfers. Also use before depositRewards to ensure
    ///         totalWeight > 0 so no rewards are wasted.
    function syncFor(address account) external nonReentrant updateReward(account) {
        _syncWeight(account);
    }

    /// @notice Batch-sync multiple addresses in one transaction.
    function syncBatch(address[] calldata accounts) external nonReentrant {
        for (uint256 i = 0; i < accounts.length; i++) {
            // Inline updateReward logic for each account
            rewardPerTokenStored = rewardPerToken();
            lastUpdateTime = lastTimeRewardApplicable();
            _rewards[accounts[i]] = earned(accounts[i]);
            _userRewardPerTokenPaid[accounts[i]] = rewardPerTokenStored;
            _syncWeight(accounts[i]);
        }
    }

    /// @notice Claim accrued CLAWS rewards. Auto-syncs your NFT balance first.
    function claim() external nonReentrant updateReward(msg.sender) {
        _syncWeight(msg.sender);

        uint256 reward = _rewards[msg.sender];
        if (reward == 0) return;

        _rewards[msg.sender] = 0;
        totalRewardsClaimed += reward;
        claws.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, reward);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL
    // ══════════════════════════════════════════════════════════════

    function _syncWeight(address account) internal {
        uint256 oldWeight = weightOf[account];
        uint256 newWeight = angelNFT.balanceOf(account);

        if (newWeight == oldWeight) return;

        if (oldWeight == 0 && newWeight > 0) participantCount++;
        if (oldWeight > 0 && newWeight == 0) participantCount--;

        totalWeight = totalWeight - oldWeight + newWeight;
        weightOf[account] = newWeight;

        emit Synced(account, oldWeight, newWeight);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — REWARD FUNDING (reusable, call anytime)
    // ══════════════════════════════════════════════════════════════

    /// @notice Deposit CLAWS rewards to drip over `duration` seconds.
    ///         Can be called multiple times — leftover from current period
    ///         rolls into the new one. Use this to top up forever.
    function depositRewards(uint256 amount, uint256 duration)
        external
        onlyAdmin
        updateReward(address(0))
    {
        require(duration > 0, "zero duration");
        require(amount > 0, "zero amount");
        require(totalWeight > 0, "sync holders first");

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

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — CONTROLS
    // ══════════════════════════════════════════════════════════════

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice Rescue tokens accidentally sent to contract. Cannot touch CLAWS.
    function recoverToken(address token) external onlyAdmin {
        require(token != address(claws), "cannot recover reward token");
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    /// @notice Recover unclaimed CLAWS after the reward period ends + 90 day
    ///         grace period. Gives holders plenty of time to claim. After that,
    ///         unclaimed tokens go back to admin (treasury) instead of being
    ///         stuck forever.
    function recoverExpiredRewards() external onlyAdmin {
        require(block.timestamp > periodEnd + 90 days, "grace period not over");
        uint256 bal = claws.balanceOf(address(this));
        require(bal > 0, "nothing to recover");
        claws.safeTransfer(admin, bal);
    }
}
