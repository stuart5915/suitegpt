// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Interface for SUITE token
interface ISuiteToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

// Interface for DEX swap (0x, 1inch, Uniswap)
interface ISwapRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata data
    ) external returns (uint256 amountOut);
}

/**
 * @title SUITE Treasury
 * @dev Upgradeable treasury contract for the SUITE token ecosystem
 * 
 * Key Features:
 * - Deposit any token → swapped to USDC → mint SUITE
 * - Withdraw SUITE → burn → receive USDC
 * - 0.5% fee on deposits and withdrawals
 * - Backing rate: $1 = 1,000 SUITE (1000 * 10^18 tokens per USDC unit)
 * - Pausable for emergencies
 * - Upgradeable for future features
 * 
 * Upgrade Path:
 * - V2: Multi-asset treasury
 * - V3: Governance voting on allocations
 */
contract SuiteTreasury is 
    Initializable, 
    OwnableUpgradeable, 
    PausableUpgradeable,
    ReentrancyGuardUpgradeable 
{
    using SafeERC20 for IERC20;

    // ============================================
    // STATE VARIABLES
    // ============================================
    
    // Core contracts
    ISuiteToken public suiteToken;
    IERC20 public usdc;
    
    // Swap router for converting tokens
    address public swapRouter;
    
    // Fee configuration (basis points, 50 = 0.5%)
    uint256 public depositFeeBps;
    uint256 public withdrawFeeBps;
    uint256 public constant MAX_FEE_BPS = 500; // Max 5%
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Backing rate: 1 USDC (6 decimals) = 1000 SUITE (18 decimals)
    // So 1 USDC = 1000 * 10^18 SUITE tokens
    uint256 public constant SUITE_PER_USDC = 1000;
    
    // Authorized app contracts that can burn SUITE for usage
    mapping(address => bool) public authorizedApps;
    
    // Rate limits for security
    uint256 public maxDepositPerTx;
    uint256 public maxWithdrawPerTx;
    
    // Accumulated fees (can be withdrawn by owner)
    uint256 public accumulatedFees;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event Deposited(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 usdcReceived,
        uint256 suitesMinted,
        uint256 fee
    );
    
    event Withdrawn(
        address indexed user,
        uint256 suitesBurned,
        uint256 usdcSent,
        uint256 fee
    );
    
    event AppAuthorized(address indexed app);
    event AppRevoked(address indexed app);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event SwapRouterUpdated(address indexed newRouter);
    event FeesUpdated(uint256 depositFeeBps, uint256 withdrawFeeBps);
    
    // ============================================
    // INITIALIZER
    // ============================================
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    /**
     * @dev Initialize the treasury (called once on deploy)
     * @param _suiteToken Address of the SUITE token contract
     * @param _usdc Address of USDC on Base
     * @param _owner Address of the owner/admin
     */
    function initialize(
        address _suiteToken,
        address _usdc,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        
        suiteToken = ISuiteToken(_suiteToken);
        usdc = IERC20(_usdc);
        
        // Default fees: 0.5%
        depositFeeBps = 50;
        withdrawFeeBps = 50;
        
        // Default limits (can be updated)
        maxDepositPerTx = 100_000 * 1e6; // 100k USDC
        maxWithdrawPerTx = 100_000 * 1e6; // 100k USDC
    }
    
    // ============================================
    // DEPOSIT FUNCTIONS
    // ============================================
    
    /**
     * @dev Deposit USDC directly and receive SUITE tokens
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function depositUSDC(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(amount <= maxDepositPerTx, "Exceeds max deposit");
        
        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate fee
        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;
        accumulatedFees += fee;
        
        // Calculate SUITE to mint
        // netAmount is in USDC (6 decimals)
        // We want 1000 SUITE (18 decimals) per 1 USDC
        // So: suiteAmount = netAmount * 1000 * 10^12 (to convert 6 to 18 decimals)
        uint256 suiteAmount = netAmount * SUITE_PER_USDC * 1e12;
        
        // Mint SUITE to user
        suiteToken.mint(msg.sender, suiteAmount);
        
        emit Deposited(msg.sender, address(usdc), amount, netAmount, suiteAmount, fee);
    }
    
    /**
     * @dev Deposit any token, swap to USDC, receive SUITE
     * @param tokenIn Address of token to deposit
     * @param amount Amount of token to deposit
     * @param minUsdcOut Minimum USDC to receive from swap (slippage protection)
     * @param swapData Encoded swap data for the router
     */
    function depositToken(
        address tokenIn,
        uint256 amount,
        uint256 minUsdcOut,
        bytes calldata swapData
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(swapRouter != address(0), "Swap router not set");
        require(tokenIn != address(usdc), "Use depositUSDC for USDC");
        
        // Transfer token from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve swap router
        IERC20(tokenIn).safeIncreaseAllowance(swapRouter, amount);
        
        // Execute swap
        uint256 usdcReceived = ISwapRouter(swapRouter).swap(
            tokenIn,
            address(usdc),
            amount,
            minUsdcOut,
            swapData
        );
        
        require(usdcReceived >= minUsdcOut, "Insufficient output");
        require(usdcReceived <= maxDepositPerTx, "Exceeds max deposit");
        
        // Calculate fee
        uint256 fee = (usdcReceived * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = usdcReceived - fee;
        accumulatedFees += fee;
        
        // Calculate and mint SUITE
        uint256 suiteAmount = netAmount * SUITE_PER_USDC * 1e12;
        suiteToken.mint(msg.sender, suiteAmount);
        
        emit Deposited(msg.sender, tokenIn, amount, netAmount, suiteAmount, fee);
    }
    
    // ============================================
    // WITHDRAW FUNCTIONS
    // ============================================
    
    /**
     * @dev Withdraw SUITE for USDC
     * @param suiteAmount Amount of SUITE to burn (18 decimals)
     */
    function withdraw(uint256 suiteAmount) external nonReentrant whenNotPaused {
        require(suiteAmount > 0, "Amount must be > 0");
        
        // Calculate USDC to return
        // suiteAmount is 18 decimals
        // 1000 SUITE = 1 USDC (6 decimals)
        // usdcAmount = suiteAmount / 1000 / 10^12
        uint256 usdcAmount = suiteAmount / SUITE_PER_USDC / 1e12;
        require(usdcAmount > 0, "Amount too small");
        require(usdcAmount <= maxWithdrawPerTx, "Exceeds max withdraw");
        
        // Calculate fee
        uint256 fee = (usdcAmount * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = usdcAmount - fee;
        accumulatedFees += fee;
        
        // Check treasury has enough USDC
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient treasury");
        
        // Burn SUITE from user (requires approval or user initiated)
        suiteToken.burnFrom(msg.sender, suiteAmount);
        
        // Send USDC to user
        usdc.safeTransfer(msg.sender, netAmount);
        
        emit Withdrawn(msg.sender, suiteAmount, netAmount, fee);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @dev Get current backing rate (USDC per 1000 SUITE)
     * Returns value in USDC (6 decimals)
     */
    function getBackingRate() external view returns (uint256) {
        uint256 totalSupply = suiteToken.totalSupply();
        if (totalSupply == 0) return 1e6; // 1 USDC if no supply
        
        uint256 treasuryBalance = usdc.balanceOf(address(this)) - accumulatedFees;
        // Return USDC per 1000 SUITE (scaled for readability)
        return (treasuryBalance * SUITE_PER_USDC * 1e12) / totalSupply;
    }
    
    /**
     * @dev Get total treasury value in USDC
     */
    function getTreasuryValue() external view returns (uint256) {
        return usdc.balanceOf(address(this)) - accumulatedFees;
    }
    
    /**
     * @dev Get total SUITE supply
     */
    function getTotalSupply() external view returns (uint256) {
        return suiteToken.totalSupply();
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @dev Authorize an app contract to burn SUITE for usage
     */
    function authorizeApp(address app) external onlyOwner {
        require(app != address(0), "Invalid app address");
        authorizedApps[app] = true;
        emit AppAuthorized(app);
    }
    
    /**
     * @dev Revoke app authorization
     */
    function revokeApp(address app) external onlyOwner {
        authorizedApps[app] = false;
        emit AppRevoked(app);
    }
    
    /**
     * @dev Update swap router address
     */
    function setSwapRouter(address _router) external onlyOwner {
        swapRouter = _router;
        emit SwapRouterUpdated(_router);
    }
    
    /**
     * @dev Update fees (max 5%)
     */
    function setFees(uint256 _depositFeeBps, uint256 _withdrawFeeBps) external onlyOwner {
        require(_depositFeeBps <= MAX_FEE_BPS, "Deposit fee too high");
        require(_withdrawFeeBps <= MAX_FEE_BPS, "Withdraw fee too high");
        depositFeeBps = _depositFeeBps;
        withdrawFeeBps = _withdrawFeeBps;
        emit FeesUpdated(_depositFeeBps, _withdrawFeeBps);
    }
    
    /**
     * @dev Update rate limits
     */
    function setLimits(uint256 _maxDeposit, uint256 _maxWithdraw) external onlyOwner {
        maxDepositPerTx = _maxDeposit;
        maxWithdrawPerTx = _maxWithdraw;
    }
    
    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees(address to) external onlyOwner {
        uint256 fees = accumulatedFees;
        require(fees > 0, "No fees to withdraw");
        accumulatedFees = 0;
        usdc.safeTransfer(to, fees);
        emit FeesWithdrawn(to, fees);
    }
    
    /**
     * @dev Deposit yield profits (increases backing for all holders)
     * Called by owner after earning yield from DeFi strategies
     */
    function depositYield(uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        // No SUITE minted - this increases backing rate for everyone
    }
    
    /**
     * @dev Withdraw for yield strategies (owner only)
     * Use carefully - this is funds being moved to yield protocols
     */
    function withdrawForYield(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        usdc.safeTransfer(to, amount);
    }
    
    /**
     * @dev Pause deposits/withdrawals
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // ============================================
    // APP USAGE (for burning SUITE)
    // ============================================
    
    /**
     * @dev Called by authorized apps to charge users for usage
     * Burns SUITE from user's balance
     * @param user Address of the user
     * @param suiteAmount Amount of SUITE to burn (18 decimals)
     */
    function chargeUser(address user, uint256 suiteAmount) external {
        require(authorizedApps[msg.sender], "Not authorized app");
        suiteToken.burnFrom(user, suiteAmount);
    }
}
