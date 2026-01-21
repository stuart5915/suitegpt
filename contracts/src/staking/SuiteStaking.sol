// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ISuiteToken
 * @dev Interface for SUITE token with mint and burn capabilities
 */
interface ISuiteToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title SuiteStaking
 * @dev Stake SUITE tokens to get credits for app usage
 *
 * Two user paths:
 * 1. Crypto users: Buy SUITE on Uniswap, then stake()
 * 2. Normie users: Use buyAndStake() with USDC
 *
 * Credit mechanics:
 * - Staking gives you credits equal to staked amount
 * - Apps deduct credits via useCredits()
 * - Unstaking returns SUITE minus used credits (used credits are burned)
 */
contract SuiteStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============

    ISuiteToken public suiteToken;
    IERC20 public usdc;
    address public treasury;

    /// @notice SUITE tokens per USDC (e.g., 1000 = 1 USDC buys 1000 SUITE)
    uint256 public suitePerUsdc = 1000;

    /// @notice Total SUITE staked by each user
    mapping(address => uint256) public stakedBalance;

    /// @notice Credits consumed by each user (tracked separately, burned on unstake)
    mapping(address => uint256) public usedCredits;

    /// @notice Apps authorized to spend user credits
    mapping(address => bool) public authorizedApps;

    // ============ Events ============

    event Bought(address indexed user, uint256 usdcAmount, uint256 suiteAmount);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 returned, uint256 burned);
    event BoughtAndStaked(address indexed user, uint256 usdcAmount, uint256 suiteAmount);
    event CreditsUsed(address indexed user, address indexed app, uint256 amount);
    event AppAuthorized(address indexed app);
    event AppRevoked(address indexed app);
    event TreasuryUpdated(address indexed newTreasury);
    event SuitePerUsdcUpdated(uint256 newRate);

    // ============ Errors ============

    error ZeroAmount();
    error InsufficientStake();
    error InsufficientCredits();
    error UnauthorizedApp();
    error ZeroAddress();
    error AppAlreadyAuthorized();
    error AppNotAuthorized();

    // ============ Constructor ============

    constructor(
        address _suiteToken,
        address _usdc,
        address _treasury,
        address _owner
    ) Ownable(_owner) {
        if (_suiteToken == address(0) || _usdc == address(0) || _treasury == address(0)) {
            revert ZeroAddress();
        }
        suiteToken = ISuiteToken(_suiteToken);
        usdc = IERC20(_usdc);
        treasury = _treasury;
    }

    // ============ User Functions ============

    /**
     * @notice Buy SUITE tokens with USDC (sent to wallet, not staked)
     * @param usdcAmount Amount of USDC to spend (6 decimals)
     */
    function buy(uint256 usdcAmount) external nonReentrant whenNotPaused {
        if (usdcAmount == 0) revert ZeroAmount();

        // Calculate SUITE amount
        // USDC has 6 decimals, SUITE has 18 decimals
        // Scale up by 1e12 to convert properly
        // e.g., 1 USDC (1e6) * 1000 * 1e12 = 1000e18 SUITE
        uint256 suiteAmount = usdcAmount * suitePerUsdc * 1e12;

        // Transfer USDC to treasury
        usdc.safeTransferFrom(msg.sender, treasury, usdcAmount);

        // Mint SUITE directly to user's wallet
        suiteToken.mint(msg.sender, suiteAmount);

        emit Bought(msg.sender, usdcAmount, suiteAmount);
    }

    /**
     * @notice Stake SUITE tokens to receive credits
     * @param amount Amount of SUITE to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        // Transfer SUITE from user to this contract
        suiteToken.transferFrom(msg.sender, address(this), amount);

        // Update staked balance
        stakedBalance[msg.sender] += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake SUITE tokens
     * @dev Used credits are burned, remaining SUITE is returned
     * @param amount Amount of staked SUITE to withdraw
     *
     * Example: staked=100, used=30, unstake(50)
     * - Burns min(50, 30) = 30 from used credits
     * - Returns 50 - 30 = 20 SUITE to user
     * - New state: staked=50, used=0
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (amount > stakedBalance[msg.sender]) revert InsufficientStake();

        uint256 used = usedCredits[msg.sender];
        uint256 toBurn;
        uint256 toReturn;

        if (used >= amount) {
            // All unstaked amount goes to burning used credits
            toBurn = amount;
            toReturn = 0;
        } else {
            // Burn all used credits, return the rest
            toBurn = used;
            toReturn = amount - used;
        }

        // Update state
        stakedBalance[msg.sender] -= amount;
        usedCredits[msg.sender] -= toBurn;

        // Burn the used portion (transfer to zero address or call burn)
        if (toBurn > 0) {
            // We hold these tokens, so we burn them
            suiteToken.burn(toBurn);
        }

        // Return remaining SUITE to user
        if (toReturn > 0) {
            suiteToken.transfer(msg.sender, toReturn);
        }

        emit Unstaked(msg.sender, toReturn, toBurn);
    }

    /**
     * @notice Buy SUITE with USDC and automatically stake it
     * @param usdcAmount Amount of USDC to spend
     */
    function buyAndStake(uint256 usdcAmount) external nonReentrant whenNotPaused {
        if (usdcAmount == 0) revert ZeroAmount();

        // Calculate SUITE amount
        // USDC has 6 decimals, SUITE has 18 decimals
        // Scale up by 1e12 to convert properly
        uint256 suiteAmount = usdcAmount * suitePerUsdc * 1e12;

        // Transfer USDC to treasury
        usdc.safeTransferFrom(msg.sender, treasury, usdcAmount);

        // Mint SUITE directly to this contract (for staking)
        suiteToken.mint(address(this), suiteAmount);

        // Update staked balance
        stakedBalance[msg.sender] += suiteAmount;

        emit BoughtAndStaked(msg.sender, usdcAmount, suiteAmount);
    }

    // ============ App Functions ============

    /**
     * @notice Deduct credits from a user (called by authorized apps)
     * @param user User to deduct credits from
     * @param amount Amount of credits to use
     */
    function useCredits(address user, uint256 amount) external whenNotPaused {
        if (!authorizedApps[msg.sender]) revert UnauthorizedApp();
        if (amount == 0) revert ZeroAmount();
        if (amount > availableCredits(user)) revert InsufficientCredits();

        usedCredits[user] += amount;

        emit CreditsUsed(user, msg.sender, amount);
    }

    // ============ View Functions ============

    /**
     * @notice Get available credits for a user
     * @param user Address to check
     * @return Available credits (staked - used)
     */
    function availableCredits(address user) public view returns (uint256) {
        return stakedBalance[user] - usedCredits[user];
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize an app to spend user credits
     * @param app Address of the app contract
     */
    function authorizeApp(address app) external onlyOwner {
        if (app == address(0)) revert ZeroAddress();
        if (authorizedApps[app]) revert AppAlreadyAuthorized();

        authorizedApps[app] = true;
        emit AppAuthorized(app);
    }

    /**
     * @notice Revoke an app's authorization
     * @param app Address of the app contract
     */
    function revokeApp(address app) external onlyOwner {
        if (!authorizedApps[app]) revert AppNotAuthorized();

        authorizedApps[app] = false;
        emit AppRevoked(app);
    }

    /**
     * @notice Update the treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Update the SUITE per USDC rate
     * @param _suitePerUsdc New rate (SUITE tokens per 1 USDC)
     */
    function setSuitePerUsdc(uint256 _suitePerUsdc) external onlyOwner {
        if (_suitePerUsdc == 0) revert ZeroAmount();
        suitePerUsdc = _suitePerUsdc;
        emit SuitePerUsdcUpdated(_suitePerUsdc);
    }

    /**
     * @notice Pause all staking operations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause all staking operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
