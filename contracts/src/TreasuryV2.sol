// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for SUITE token
interface ISuiteToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

/**
 * @title SUITE Treasury V2
 * @dev Accepts both ETH and USDC deposits on Base, mints SUITE tokens
 * 
 * Features:
 * - Deposit ETH → mint SUITE (based on ETH price)
 * - Deposit USDC → mint SUITE (1000 SUITE per $1)
 * - Withdraw SUITE → receive USDC
 * - 0.5% fee on deposits and withdrawals
 * - Supports tiny amounts (< $1)
 */
contract TreasuryV2 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core contracts
    ISuiteToken public suiteToken;
    IERC20 public usdc;
    
    // ETH price in USD (6 decimals) - e.g., 3650000000 = $3650
    uint256 public ethPriceUsd = 3650 * 1e6; // Default $3650
    
    // Fee configuration (basis points, 50 = 0.5%)
    uint256 public depositFeeBps = 50;
    uint256 public withdrawFeeBps = 50;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Backing rate: 1 USD = 1000 SUITE (18 decimals)
    uint256 public constant SUITE_PER_USD = 1000;
    
    // Accumulated fees  
    uint256 public accumulatedUsdcFees;
    uint256 public accumulatedEthFees;
    
    // Events
    event DepositedETH(address indexed user, uint256 ethAmount, uint256 usdValue, uint256 suitesMinted, uint256 fee);
    event DepositedUSDC(address indexed user, uint256 usdcAmount, uint256 suitesMinted, uint256 fee);
    event Withdrawn(address indexed user, uint256 suitesBurned, uint256 usdcSent, uint256 fee);
    event EthPriceUpdated(uint256 newPrice);

    constructor(
        address _suiteToken,
        address _usdc,
        address _owner
    ) Ownable(_owner) {
        suiteToken = ISuiteToken(_suiteToken);
        usdc = IERC20(_usdc);
    }
    
    /**
     * @dev Deposit ETH and receive SUITE tokens
     * Accepts any amount, including tiny amounts < $1
     */
    function depositETH() external payable nonReentrant {
        require(msg.value > 0, "Amount must be > 0");
        
        // Calculate USD value (msg.value is in wei, 18 decimals)
        // ethPriceUsd has 6 decimals, so divide by 1e18 to get USD value in 6 decimals
        uint256 usdValue = (msg.value * ethPriceUsd) / 1e18;
        require(usdValue > 0, "Value too small");
        
        // Calculate fee (in 6 decimal USD)
        uint256 fee = (msg.value * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netEth = msg.value - fee;
        accumulatedEthFees += fee;
        
        // Calculate net USD value after fee
        uint256 netUsdValue = (netEth * ethPriceUsd) / 1e18;
        
        // Calculate SUITE to mint
        // usdValue is in 6 decimals, SUITE has 18 decimals
        // SUITE = netUsdValue * 1000 * 1e12 (to convert 6 to 18 decimals)
        uint256 suiteAmount = netUsdValue * SUITE_PER_USD * 1e12;
        require(suiteAmount > 0, "SUITE amount too small");
        
        // Mint SUITE to user
        suiteToken.mint(msg.sender, suiteAmount);
        
        emit DepositedETH(msg.sender, msg.value, usdValue, suiteAmount, fee);
    }
    
    /**
     * @dev Deposit USDC and receive SUITE tokens
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function depositUSDC(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate fee
        uint256 fee = (amount * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = amount - fee;
        accumulatedUsdcFees += fee;
        
        // Calculate SUITE to mint (1000 SUITE per 1 USDC)
        uint256 suiteAmount = netAmount * SUITE_PER_USD * 1e12;
        
        // Mint SUITE to user
        suiteToken.mint(msg.sender, suiteAmount);
        
        emit DepositedUSDC(msg.sender, amount, suiteAmount, fee);
    }
    
    /**
     * @dev Withdraw SUITE for USDC
     * @param suiteAmount Amount of SUITE to burn (18 decimals)
     */
    function withdraw(uint256 suiteAmount) external nonReentrant {
        require(suiteAmount > 0, "Amount must be > 0");
        
        // Calculate USDC to return
        uint256 usdcAmount = suiteAmount / SUITE_PER_USD / 1e12;
        require(usdcAmount > 0, "Amount too small");
        
        // Calculate fee
        uint256 fee = (usdcAmount * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = usdcAmount - fee;
        accumulatedUsdcFees += fee;
        
        // Check treasury has enough USDC
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient USDC");
        
        // Burn SUITE from user
        suiteToken.burnFrom(msg.sender, suiteAmount);
        
        // Send USDC to user
        usdc.safeTransfer(msg.sender, netAmount);
        
        emit Withdrawn(msg.sender, suiteAmount, netAmount, fee);
    }
    
    /**
     * @dev Update ETH price (owner only)
     * @param newPrice New ETH price in USD with 6 decimals (e.g., 3650000000 = $3650)
     */
    function setEthPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Invalid price");
        ethPriceUsd = newPrice;
        emit EthPriceUpdated(newPrice);
    }
    
    /**
     * @dev Get treasury balances
     */
    function getTreasuryBalances() external view returns (uint256 ethBalance, uint256 usdcBalance) {
        ethBalance = address(this).balance - accumulatedEthFees;
        usdcBalance = usdc.balanceOf(address(this)) - accumulatedUsdcFees;
    }
    
    /**
     * @dev Withdraw accumulated USDC fees
     */
    function withdrawUsdcFees(address to) external onlyOwner {
        uint256 fees = accumulatedUsdcFees;
        require(fees > 0, "No fees");
        accumulatedUsdcFees = 0;
        usdc.safeTransfer(to, fees);
    }
    
    /**
     * @dev Withdraw accumulated ETH fees
     */
    function withdrawEthFees(address to) external onlyOwner {
        uint256 fees = accumulatedEthFees;
        require(fees > 0, "No fees");
        accumulatedEthFees = 0;
        payable(to).transfer(fees);
    }
    
    /**
     * @dev Receive ETH directly (calls depositETH)
     */
    receive() external payable {
        // Direct ETH sends are held, use depositETH() to get SUITE
    }
}
