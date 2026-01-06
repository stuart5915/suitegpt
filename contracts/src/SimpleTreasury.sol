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
 * @title SUITE Treasury (Simple Version)
 * @dev Simple treasury for SUITE token - deposits USDC, mints SUITE
 * 
 * Features:
 * - Deposit USDC → mint SUITE (1000 SUITE per $1)
 * - Withdraw SUITE → burn → receive USDC
 * - 0.5% fee on deposits and withdrawals
 */
contract SimpleTreasury is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core contracts
    ISuiteToken public suiteToken;
    IERC20 public usdc;
    
    // Fee configuration (basis points, 50 = 0.5%)
    uint256 public depositFeeBps = 50;
    uint256 public withdrawFeeBps = 50;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Backing rate: 1 USDC (6 decimals) = 1000 SUITE (18 decimals)
    uint256 public constant SUITE_PER_USDC = 1000;
    
    // Accumulated fees
    uint256 public accumulatedFees;
    
    // Events
    event Deposited(address indexed user, uint256 usdcAmount, uint256 suitesMinted, uint256 fee);
    event Withdrawn(address indexed user, uint256 suitesBurned, uint256 usdcSent, uint256 fee);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event ETHReceived(address indexed from, uint256 amount);

    constructor(
        address _suiteToken,
        address _usdc,
        address _owner
    ) Ownable(_owner) {
        suiteToken = ISuiteToken(_suiteToken);
        usdc = IERC20(_usdc);
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
        accumulatedFees += fee;
        
        // Calculate SUITE to mint (1000 SUITE per 1 USDC, adjust for decimals)
        uint256 suiteAmount = netAmount * SUITE_PER_USDC * 1e12;
        
        // Mint SUITE to user
        suiteToken.mint(msg.sender, suiteAmount);
        
        emit Deposited(msg.sender, amount, suiteAmount, fee);
    }
    
    /**
     * @dev Withdraw SUITE for USDC
     * @param suiteAmount Amount of SUITE to burn (18 decimals)
     */
    function withdraw(uint256 suiteAmount) external nonReentrant {
        require(suiteAmount > 0, "Amount must be > 0");
        
        // Calculate USDC to return
        uint256 usdcAmount = suiteAmount / SUITE_PER_USDC / 1e12;
        require(usdcAmount > 0, "Amount too small");
        
        // Calculate fee
        uint256 fee = (usdcAmount * withdrawFeeBps) / BPS_DENOMINATOR;
        uint256 netAmount = usdcAmount - fee;
        accumulatedFees += fee;
        
        // Check treasury has enough USDC
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient treasury");
        
        // Burn SUITE from user
        suiteToken.burnFrom(msg.sender, suiteAmount);
        
        // Send USDC to user
        usdc.safeTransfer(msg.sender, netAmount);
        
        emit Withdrawn(msg.sender, suiteAmount, netAmount, fee);
    }
    
    /**
     * @dev Get treasury USDC balance
     */
    function getTreasuryValue() external view returns (uint256) {
        return usdc.balanceOf(address(this)) - accumulatedFees;
    }
    
    /**
     * @dev Withdraw accumulated fees
     */
    function withdrawFees(address to) external onlyOwner {
        uint256 fees = accumulatedFees;
        require(fees > 0, "No fees");
        accumulatedFees = 0;
        usdc.safeTransfer(to, fees);
        emit FeesWithdrawn(to, fees);
    }
    
    /**
     * @dev Receive ETH (for future ETH deposits)
     */
    receive() external payable {
        emit ETHReceived(msg.sender, msg.value);
    }
}
