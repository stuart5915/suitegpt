// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

/// @notice Minimal Uniswap V3 SwapRouter interface
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @notice Minimal WETH interface
interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title InclawbateUBI — Trustless On-Chain UBI Staking & Treasury (Upgradeable)
/// @notice Stake $CLAWNCH (1x) or $inCLAWNCH (2x) to earn daily UBI.
///         Anyone can deposit into the treasury. Distribution is automated via Chainlink.
///         Admin CANNOT access funds. No lock. No rug.
///         UUPS upgradeable — admin can push upgrades until renounceUpgradeability() is called.
contract InclawbateUBI is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    AutomationCompatibleInterface
{
    using SafeERC20 for IERC20;

    // ========== CONFIG (set once in initialize, never changed) ==========

    IERC20 public clawnchToken;
    IERC20 public inClawnchToken;
    IWETH public weth;
    ISwapRouter public swapRouter;
    address public admin;
    address public kingdomAddress;
    uint24 public poolFee;

    // ========== CONSTANTS ==========

    uint256 public constant CLAWNCH_WEIGHT = 1;
    uint256 public constant INCLAWNCH_WEIGHT = 2;
    uint256 public constant DISTRIBUTION_INTERVAL = 24 hours;
    uint256 private constant PRECISION = 1e18;

    // ========== STAKING STATE ==========

    uint256 public totalClawnchStaked;
    uint256 public totalInClawnchStaked;
    uint256 public totalEffectiveStake;
    uint256 public stakerCount;

    struct UserStake {
        uint256 clawnchAmount;
        uint256 inClawnchAmount;
        uint256 effectiveStake;
        uint256 stakeTimestamp;
        uint256 rewardPerTokenPaid;
        uint256 pendingRewards;
    }
    mapping(address => UserStake) public stakes;

    // ========== REWARD SPLIT PREFERENCES ==========

    struct RewardPrefs {
        uint8 keepPct;       // % sent to wallet (or auto-staked if autoCompound)
        uint8 kingdomPct;    // % sent to Kingdom address
        uint8 ubiFundPct;    // % recycled back into reward pool for all stakers
        bool autoCompound;   // if true, Keep % is re-staked as CLAWNCH instead of sent
        bool isSet;          // true once user has called setRewardPrefs
    }
    mapping(address => RewardPrefs) public rewardPrefs;

    // ========== REWARD STATE (Synthetix pattern) ==========

    uint256 public rewardPerTokenStored;
    uint256 public lastDistributionTime;
    uint256 public totalDistributed;
    uint256 public pendingRewardPool;

    // ========== TREASURY STATE ==========

    mapping(address => uint256) public donorLifetimeDeposits;
    uint256 public totalLifetimeDeposits;

    // ========== ADMIN STATE ==========

    bool public paused;
    bool public upgradeRenounced; // once true, contract can never be upgraded again
    bool public migrationComplete; // one-time migration lock

    // ========== EVENTS ==========

    event Staked(address indexed user, address indexed token, uint256 amount, uint256 effectiveStake);
    event Unstaked(address indexed user, address indexed token, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDistributed(uint256 amount, uint256 timestamp);
    event TreasuryDeposit(address indexed donor, address indexed token, uint256 amountIn, uint256 clawnchReceived);
    event ETHReceived(address indexed sender, uint256 amount, uint256 clawnchReceived);
    event RewardPrefsSet(address indexed user, uint8 keepPct, uint8 kingdomPct, uint8 ubiFundPct, bool autoCompound);
    event RewardCompounded(address indexed user, uint256 amount);
    event RewardToKingdom(address indexed user, uint256 amount);
    event RewardToUBIFund(address indexed user, uint256 amount);
    event Paused(address indexed admin);
    event Unpaused(address indexed admin);
    event UpgradeRenounced(address indexed admin);
    event KingdomAddressUpdated(address indexed oldAddress, address indexed newAddress);
    event StakerMigrated(address indexed user, uint256 clawnchAmount, uint256 inClawnchAmount);
    event MigrationCompleted(uint256 stakersMigrated);

    // ========== MODIFIERS ==========

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    modifier updateReward(address account) {
        if (account != address(0)) {
            stakes[account].pendingRewards = pendingRewards(account);
            stakes[account].rewardPerTokenPaid = rewardPerTokenStored;
        }
        _;
    }

    // ========== INITIALIZER (replaces constructor) ==========

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _clawnch,
        address _inClawnch,
        address _weth,
        address _swapRouter,
        address _admin,
        address _kingdom,
        uint24 _poolFee
    ) external initializer {
        require(_clawnch != address(0), "Zero address");
        require(_inClawnch != address(0), "Zero address");
        require(_weth != address(0), "Zero address");
        require(_swapRouter != address(0), "Zero address");
        require(_admin != address(0), "Zero address");
        require(_kingdom != address(0), "Zero address");

        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        clawnchToken = IERC20(_clawnch);
        inClawnchToken = IERC20(_inClawnch);
        weth = IWETH(_weth);
        swapRouter = ISwapRouter(_swapRouter);
        admin = _admin;
        kingdomAddress = _kingdom;
        poolFee = _poolFee;
        lastDistributionTime = block.timestamp;
    }

    // ========== UUPS UPGRADE AUTHORIZATION ==========

    /// @dev Only admin can authorize upgrades, and only if not renounced.
    function _authorizeUpgrade(address) internal view override {
        require(msg.sender == admin, "Not admin");
        require(!upgradeRenounced, "Upgrades renounced");
    }

    /// @notice Permanently disable upgrades. Cannot be undone. Call this once the
    ///         contract is battle-tested and you want to lock it as immutable forever.
    function renounceUpgradeability() external onlyAdmin {
        upgradeRenounced = true;
        emit UpgradeRenounced(msg.sender);
    }

    // ================================================================
    //                        PART 1: STAKING
    // ================================================================

    function stakeClawnch(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Zero amount");

        clawnchToken.safeTransferFrom(msg.sender, address(this), amount);

        UserStake storage user = stakes[msg.sender];
        if (user.effectiveStake == 0) stakerCount++;

        user.clawnchAmount += amount;
        uint256 addedWeight = amount * CLAWNCH_WEIGHT;
        user.effectiveStake += addedWeight;
        totalClawnchStaked += amount;
        totalEffectiveStake += addedWeight;

        if (user.stakeTimestamp == 0) user.stakeTimestamp = block.timestamp;

        emit Staked(msg.sender, address(clawnchToken), amount, user.effectiveStake);
    }

    function stakeInClawnch(uint256 amount) external nonReentrant whenNotPaused updateReward(msg.sender) {
        require(amount > 0, "Zero amount");

        inClawnchToken.safeTransferFrom(msg.sender, address(this), amount);

        UserStake storage user = stakes[msg.sender];
        if (user.effectiveStake == 0) stakerCount++;

        user.inClawnchAmount += amount;
        uint256 addedWeight = amount * INCLAWNCH_WEIGHT;
        user.effectiveStake += addedWeight;
        totalInClawnchStaked += amount;
        totalEffectiveStake += addedWeight;

        if (user.stakeTimestamp == 0) user.stakeTimestamp = block.timestamp;

        emit Staked(msg.sender, address(inClawnchToken), amount, user.effectiveStake);
    }

    /// @notice Unstake $CLAWNCH. Always allowed, even when paused.
    function unstakeClawnch(uint256 amount) external nonReentrant updateReward(msg.sender) {
        UserStake storage user = stakes[msg.sender];
        require(amount > 0, "Zero amount");
        require(user.clawnchAmount >= amount, "Exceeds staked");

        user.clawnchAmount -= amount;
        uint256 removedWeight = amount * CLAWNCH_WEIGHT;
        user.effectiveStake -= removedWeight;
        totalClawnchStaked -= amount;
        totalEffectiveStake -= removedWeight;

        if (user.effectiveStake == 0) {
            user.stakeTimestamp = 0;
            stakerCount--;
        }

        clawnchToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, address(clawnchToken), amount);
    }

    /// @notice Unstake $inCLAWNCH. Always allowed, even when paused.
    function unstakeInClawnch(uint256 amount) external nonReentrant updateReward(msg.sender) {
        UserStake storage user = stakes[msg.sender];
        require(amount > 0, "Zero amount");
        require(user.inClawnchAmount >= amount, "Exceeds staked");

        user.inClawnchAmount -= amount;
        uint256 removedWeight = amount * INCLAWNCH_WEIGHT;
        user.effectiveStake -= removedWeight;
        totalInClawnchStaked -= amount;
        totalEffectiveStake -= removedWeight;

        if (user.effectiveStake == 0) {
            user.stakeTimestamp = 0;
            stakerCount--;
        }

        inClawnchToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, address(inClawnchToken), amount);
    }

    // ================================================================
    //                    REWARD PREFERENCES & CLAIMS
    // ================================================================

    /// @notice Set how your rewards are split. Must sum to 100.
    ///         Default (before calling this): 100% Keep, sent to wallet.
    function setRewardPrefs(uint8 keepPct, uint8 kingdomPct, uint8 ubiFundPct, bool autoCompound) external {
        require(uint256(keepPct) + uint256(kingdomPct) + uint256(ubiFundPct) == 100, "Must sum to 100");

        rewardPrefs[msg.sender] = RewardPrefs({
            keepPct: keepPct,
            kingdomPct: kingdomPct,
            ubiFundPct: ubiFundPct,
            autoCompound: autoCompound,
            isSet: true
        });

        emit RewardPrefsSet(msg.sender, keepPct, kingdomPct, ubiFundPct, autoCompound);
    }

    /// @notice Claim rewards, split according to your preferences.
    ///         Keep → wallet (or auto-compound into CLAWNCH stake).
    ///         Kingdom → kingdom address. UBI Fund → back into reward pool.
    ///         Always allowed, even when paused.
    function claimRewards() external nonReentrant updateReward(msg.sender) {
        uint256 reward = stakes[msg.sender].pendingRewards;
        require(reward > 0, "No rewards");

        stakes[msg.sender].pendingRewards = 0;

        RewardPrefs storage prefs = rewardPrefs[msg.sender];

        // Default: 100% to wallet if user never set prefs
        if (!prefs.isSet) {
            clawnchToken.safeTransfer(msg.sender, reward);
            emit RewardsClaimed(msg.sender, reward);
            return;
        }

        uint256 keepAmount = (reward * prefs.keepPct) / 100;
        uint256 kingdomAmount = (reward * prefs.kingdomPct) / 100;
        uint256 ubiFundAmount = reward - keepAmount - kingdomAmount; // remainder avoids rounding dust

        // Keep portion: send to wallet or auto-compound
        if (keepAmount > 0) {
            if (prefs.autoCompound) {
                UserStake storage user = stakes[msg.sender];
                if (user.effectiveStake == 0) stakerCount++;
                user.clawnchAmount += keepAmount;
                uint256 addedWeight = keepAmount * CLAWNCH_WEIGHT;
                user.effectiveStake += addedWeight;
                totalClawnchStaked += keepAmount;
                totalEffectiveStake += addedWeight;
                if (user.stakeTimestamp == 0) user.stakeTimestamp = block.timestamp;
                emit RewardCompounded(msg.sender, keepAmount);
            } else {
                clawnchToken.safeTransfer(msg.sender, keepAmount);
            }
        }

        // Kingdom portion
        if (kingdomAmount > 0) {
            clawnchToken.safeTransfer(kingdomAddress, kingdomAmount);
            emit RewardToKingdom(msg.sender, kingdomAmount);
        }

        // UBI Fund portion: recycle back into treasury for all stakers
        if (ubiFundAmount > 0) {
            pendingRewardPool += ubiFundAmount;
            emit RewardToUBIFund(msg.sender, ubiFundAmount);
        }

        emit RewardsClaimed(msg.sender, reward);
    }

    // ================================================================
    //                    PART 2: PUBLIC TREASURY
    // ================================================================

    /// @notice Deposit $CLAWNCH directly into the reward pool. 100% goes to stakers.
    function depositClawnch(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");

        clawnchToken.safeTransferFrom(msg.sender, address(this), amount);
        pendingRewardPool += amount;
        donorLifetimeDeposits[msg.sender] += amount;
        totalLifetimeDeposits += amount;

        emit TreasuryDeposit(msg.sender, address(clawnchToken), amount, amount);
    }

    /// @notice Deposit WETH — auto-swaps to $CLAWNCH via Uniswap.
    function depositWETH(uint256 amount, uint256 minClawnchOut) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");

        IERC20(address(weth)).safeTransferFrom(msg.sender, address(this), amount);
        uint256 clawnchReceived = _swapWETHToClawnch(amount, minClawnchOut);

        pendingRewardPool += clawnchReceived;
        donorLifetimeDeposits[msg.sender] += clawnchReceived;
        totalLifetimeDeposits += clawnchReceived;

        emit TreasuryDeposit(msg.sender, address(weth), amount, clawnchReceived);
    }

    /// @notice Send raw ETH — auto-wraps to WETH, swaps to $CLAWNCH, adds to reward pool.
    receive() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Zero amount");

        weth.deposit{value: msg.value}();
        uint256 clawnchReceived = _swapWETHToClawnch(msg.value, 0);

        pendingRewardPool += clawnchReceived;
        donorLifetimeDeposits[msg.sender] += clawnchReceived;
        totalLifetimeDeposits += clawnchReceived;

        emit ETHReceived(msg.sender, msg.value, clawnchReceived);
    }

    function _swapWETHToClawnch(uint256 wethAmount, uint256 minAmountOut) internal returns (uint256) {
        IERC20(address(weth)).approve(address(swapRouter), wethAmount);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(weth),
            tokenOut: address(clawnchToken),
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: wethAmount,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });

        return swapRouter.exactInputSingle(params);
    }

    // ================================================================
    //                 PART 3: AUTOMATED DISTRIBUTION
    // ================================================================

    /// @notice Chainlink Automation: check if distribution is due.
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = (
            block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL &&
            pendingRewardPool > 0 &&
            totalEffectiveStake > 0
        );
        performData = "";
    }

    /// @notice Chainlink Automation: execute daily distribution.
    function performUpkeep(bytes calldata) external override nonReentrant {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Too early");
        require(pendingRewardPool > 0, "Nothing to distribute");
        require(totalEffectiveStake > 0, "No stakers");

        _distributeRewards();
    }

    /// @notice Manual backup: anyone can trigger distribution if 24h have passed.
    function triggerDistribution() external nonReentrant {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Too early");
        require(pendingRewardPool > 0, "Nothing to distribute");
        require(totalEffectiveStake > 0, "No stakers");

        _distributeRewards();
    }

    function _distributeRewards() internal {
        uint256 rewardAmount = pendingRewardPool;
        pendingRewardPool = 0;

        rewardPerTokenStored += (rewardAmount * PRECISION) / totalEffectiveStake;
        lastDistributionTime = block.timestamp;
        totalDistributed += rewardAmount;

        emit RewardsDistributed(rewardAmount, block.timestamp);
    }

    // ================================================================
    //                       VIEW FUNCTIONS
    // ================================================================

    function pendingRewards(address user) public view returns (uint256) {
        UserStake storage s = stakes[user];
        if (s.effectiveStake == 0) return s.pendingRewards;
        return s.pendingRewards + (s.effectiveStake * (rewardPerTokenStored - s.rewardPerTokenPaid)) / PRECISION;
    }

    function getUserStake(address user) external view returns (
        uint256 clawnchAmount,
        uint256 inClawnchAmount,
        uint256 effectiveStake,
        uint256 stakeTimestamp,
        uint256 pending
    ) {
        UserStake storage s = stakes[user];
        return (s.clawnchAmount, s.inClawnchAmount, s.effectiveStake, s.stakeTimestamp, pendingRewards(user));
    }

    function getUserPrefs(address user) external view returns (
        uint8 keepPct,
        uint8 kingdomPct,
        uint8 ubiFundPct,
        bool autoCompound
    ) {
        RewardPrefs storage p = rewardPrefs[user];
        if (!p.isSet) return (100, 0, 0, false);
        return (p.keepPct, p.kingdomPct, p.ubiFundPct, p.autoCompound);
    }

    function totalStaked() external view returns (
        uint256 clawnch,
        uint256 inClawnch,
        uint256 effective
    ) {
        return (totalClawnchStaked, totalInClawnchStaked, totalEffectiveStake);
    }

    function pendingTreasuryBalance() external view returns (uint256) {
        return pendingRewardPool;
    }

    function depositsFrom(address donor) external view returns (uint256) {
        return donorLifetimeDeposits[donor];
    }

    function timeUntilNextDistribution() external view returns (uint256) {
        uint256 nextTime = lastDistributionTime + DISTRIBUTION_INTERVAL;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }

    /// @notice Contract version — increment this on each upgrade.
    function version() external pure returns (uint256) {
        return 1;
    }

    // ========== MIGRATION (one-time) ==========

    struct MigrateEntry {
        address user;
        uint256 clawnchAmount;
        uint256 inClawnchAmount;
    }

    /// @notice One-time bulk migration from off-chain staking system.
    ///         Admin sends tokens to the contract first, then calls this to assign stakes.
    ///         Can only be called ONCE. After this, all staking is self-service.
    function migrateStakers(MigrateEntry[] calldata entries) external onlyAdmin {
        require(!migrationComplete, "Migration already done");

        for (uint256 i = 0; i < entries.length; i++) {
            address user = entries[i].user;
            uint256 clawnch = entries[i].clawnchAmount;
            uint256 inClawnch = entries[i].inClawnchAmount;

            require(user != address(0), "Zero address");
            require(clawnch > 0 || inClawnch > 0, "Zero amounts");

            UserStake storage s = stakes[user];
            require(s.effectiveStake == 0, "User already staked");

            uint256 weight = (clawnch * CLAWNCH_WEIGHT) + (inClawnch * INCLAWNCH_WEIGHT);

            s.clawnchAmount = clawnch;
            s.inClawnchAmount = inClawnch;
            s.effectiveStake = weight;
            s.stakeTimestamp = block.timestamp;
            s.rewardPerTokenPaid = rewardPerTokenStored;

            totalClawnchStaked += clawnch;
            totalInClawnchStaked += inClawnch;
            totalEffectiveStake += weight;
            stakerCount++;

            emit StakerMigrated(user, clawnch, inClawnch);
        }

        migrationComplete = true;
        emit MigrationCompleted(entries.length);
    }

    // ========== ADMIN (minimal) ==========

    /// @notice Pause new stakes and deposits. Does NOT prevent withdrawals or claims.
    function pause() external onlyAdmin {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Update the Kingdom donation address. Only admin.
    function setKingdomAddress(address _kingdom) external onlyAdmin {
        require(_kingdom != address(0), "Zero address");
        emit KingdomAddressUpdated(kingdomAddress, _kingdom);
        kingdomAddress = _kingdom;
    }
}
