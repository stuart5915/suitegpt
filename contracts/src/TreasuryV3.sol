// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Uniswap V3 Router interface (for token swaps)
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

// WETH interface
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

// SUITE Token interface
interface ISuiteToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

/**
 * @title TreasuryV3 - Proportional Share Model
 * @dev SUITE = Your % of the Treasury. Always solvent.
 * 
 * Features:
 * - Deposit ETH → Mint proportional SUITE
 * - Deposit any token → Swap to ETH → Mint proportional SUITE
 * - Withdraw SUITE → Get proportional ETH back
 * - No time lock (for testing)
 * - Always solvent (proportional shares)
 */
contract TreasuryV3 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core contracts
    ISuiteToken public suiteToken;
    ISwapRouter public swapRouter;
    IWETH public weth;
    
    // Treasury state
    uint256 public totalTreasuryETH;
    
    // Fee configuration (basis points, 50 = 0.5%)
    uint256 public depositFeeBps = 50;
    uint256 public withdrawFeeBps = 50;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Initial rate: 1 ETH = 1,000,000 SUITE (when treasury is empty)
    uint256 public constant INITIAL_RATE = 1_000_000 * 1e18;
    
    // Swap settings
    uint24 public defaultPoolFee = 3000; // 0.3% Uniswap pool
    uint256 public maxSlippageBps = 100; // 1% max slippage
    
    // Accumulated fees
    uint256 public accumulatedFees;
    
    // Events
    event DepositedETH(address indexed user, uint256 ethAmount, uint256 suiteMinted);
    event DepositedToken(address indexed user, address token, uint256 tokenAmount, uint256 ethReceived, uint256 suiteMinted);
    event Withdrawn(address indexed user, uint256 suiteBurned, uint256 ethReturned);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(
        address _suiteToken,
        address _swapRouter,
        address _weth,
        address _owner
    ) Ownable(_owner) {
        suiteToken = ISuiteToken(_suiteToken);
        swapRouter = ISwapRouter(_swapRouter);
        weth = IWETH(_weth);
    }
    
    // ============ DEPOSIT FUNCTIONS ============
    
    /**
     * @dev Deposit ETH and receive proportional SUITE
     */
    function depositETH() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");
        
        // Calculate fee
        uint256 fee = (msg.value * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netETH = msg.value - fee;
        accumulatedFees += fee;
        
        // Calculate SUITE to mint (proportional to treasury)
        uint256 suiteToMint = _calculateMint(netETH);
        
        // Update treasury balance
        totalTreasuryETH += netETH;
        
        // Mint SUITE to user
        suiteToken.mint(msg.sender, suiteToMint);
        
        emit DepositedETH(msg.sender, msg.value, suiteToMint);
    }
    
    /**
     * @dev Deposit any ERC-20 token, swap to ETH, mint proportional SUITE
     * @param token Address of token to deposit
     * @param amount Amount of token to deposit
     * @param minETHOut Minimum ETH expected (slippage protection)
     */
    function depositToken(
        address token,
        uint256 amount,
        uint256 minETHOut
    ) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(token != address(0), "Invalid token");
        
        // Transfer token from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve swap router
        IERC20(token).approve(address(swapRouter), amount);
        
        // Swap token → WETH
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: token,
            tokenOut: address(weth),
            fee: defaultPoolFee,
            recipient: address(this),
            amountIn: amount,
            amountOutMinimum: minETHOut,
            sqrtPriceLimitX96: 0
        });
        
        uint256 wethReceived = swapRouter.exactInputSingle(params);
        
        // Unwrap WETH to ETH
        weth.withdraw(wethReceived);
        
        // Calculate fee
        uint256 fee = (wethReceived * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netETH = wethReceived - fee;
        accumulatedFees += fee;
        
        // Calculate SUITE to mint
        uint256 suiteToMint = _calculateMint(netETH);
        
        // Update treasury
        totalTreasuryETH += netETH;
        
        // Mint SUITE
        suiteToken.mint(msg.sender, suiteToMint);
        
        emit DepositedToken(msg.sender, token, amount, wethReceived, suiteToMint);
    }
    
    // ============ WITHDRAW FUNCTIONS ============
    
    /**
     * @dev Withdraw SUITE and receive proportional ETH
     * @param suiteAmount Amount of SUITE to burn
     */
    function withdraw(uint256 suiteAmount) external nonReentrant {
        require(suiteAmount > 0, "Amount must be > 0");
        
        uint256 totalSupply = suiteToken.totalSupply();
        require(totalSupply > 0, "No SUITE in circulation");
        
        // Calculate user's share of treasury
        uint256 userShare = (suiteAmount * 1e18) / totalSupply;
        uint256 grossETH = (userShare * totalTreasuryETH) / 1e18;
        
        // Calculate fee
        uint256 fee = (grossETH * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netETH = grossETH - fee;
        accumulatedFees += fee;
        
        require(netETH > 0, "Withdrawal too small");
        require(address(this).balance >= grossETH, "Insufficient treasury");
        
        // Update treasury
        totalTreasuryETH -= grossETH;
        
        // Burn user's SUITE
        suiteToken.burnFrom(msg.sender, suiteAmount);
        
        // Send ETH to user
        (bool success, ) = payable(msg.sender).call{value: netETH}("");
        require(success, "ETH transfer failed");
        
        emit Withdrawn(msg.sender, suiteAmount, netETH);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Calculate SUITE to mint for a given ETH deposit
     */
    function _calculateMint(uint256 ethAmount) internal view returns (uint256) {
        uint256 totalSupply = suiteToken.totalSupply();
        
        if (totalTreasuryETH == 0 || totalSupply == 0) {
            // Initial rate: 1 ETH = 1,000,000 SUITE
            return ethAmount * INITIAL_RATE / 1e18;
        }
        
        // Proportional: new_suite = eth_amount * total_supply / total_treasury
        return (ethAmount * totalSupply) / totalTreasuryETH;
    }
    
    /**
     * @dev Preview how much SUITE you'd get for an ETH deposit
     */
    function previewDeposit(uint256 ethAmount) external view returns (uint256 suiteAmount) {
        uint256 fee = (ethAmount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netETH = ethAmount - fee;
        return _calculateMint(netETH);
    }
    
    /**
     * @dev Preview how much ETH you'd get for a SUITE withdrawal
     */
    function previewWithdraw(uint256 suiteAmount) external view returns (uint256 ethAmount) {
        uint256 totalSupply = suiteToken.totalSupply();
        if (totalSupply == 0) return 0;
        
        uint256 userShare = (suiteAmount * 1e18) / totalSupply;
        uint256 grossETH = (userShare * totalTreasuryETH) / 1e18;
        uint256 fee = (grossETH * withdrawFeeBps) / BPS_DENOMINATOR;
        
        return grossETH - fee;
    }
    
    /**
     * @dev Get current treasury stats
     */
    function getTreasuryStats() external view returns (
        uint256 treasuryETH,
        uint256 totalSupply,
        uint256 suitePerETH
    ) {
        treasuryETH = totalTreasuryETH;
        totalSupply = suiteToken.totalSupply();
        
        if (treasuryETH == 0 || totalSupply == 0) {
            suitePerETH = INITIAL_RATE / 1e18;
        } else {
            suitePerETH = (totalSupply * 1e18) / treasuryETH;
        }
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees(address to) external onlyOwner {
        uint256 fees = accumulatedFees;
        require(fees > 0, "No fees");
        accumulatedFees = 0;
        
        (bool success, ) = payable(to).call{value: fees}("");
        require(success, "Transfer failed");
        
        emit FeesWithdrawn(to, fees);
    }
    
    /**
     * @dev Update fee settings
     */
    function setFees(uint256 _depositFeeBps, uint256 _withdrawFeeBps) external onlyOwner {
        require(_depositFeeBps <= 500, "Deposit fee too high"); // Max 5%
        require(_withdrawFeeBps <= 500, "Withdraw fee too high");
        depositFeeBps = _depositFeeBps;
        withdrawFeeBps = _withdrawFeeBps;
    }
    
    /**
     * @dev Update swap settings
     */
    function setSwapSettings(uint24 _poolFee, uint256 _maxSlippageBps) external onlyOwner {
        defaultPoolFee = _poolFee;
        maxSlippageBps = _maxSlippageBps;
    }
    
    /**
     * @dev Receive ETH (for WETH unwrapping)
     */
    receive() external payable {}
}
