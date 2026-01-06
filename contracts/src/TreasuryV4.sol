// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// SUITE Token interface
interface ISuiteToken {
    function mint(address to, uint256 amount) external;
    function burnFrom(address from, uint256 amount) external;
    function totalSupply() external view returns (uint256);
}

/**
 * @title TreasuryV4 - Proportional Share Model with 0x Aggregator
 * @dev SUITE = Your % of the Treasury. Always solvent.
 * 
 * Features:
 * - Deposit ETH → Mint proportional SUITE
 * - Deposit any token → 0x swaps to ETH → Mint proportional SUITE
 * - Frontend calls 0x API, gets swap calldata, passes to depositWithSwap()
 * - Withdraw SUITE → Get proportional ETH back
 * - No time lock (for testing)
 * - Always solvent (proportional shares)
 */
contract TreasuryV4 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Core contracts
    ISuiteToken public suiteToken;
    
    // 0x Exchange Proxy on Base
    address public constant ZERO_X_EXCHANGE_PROXY = 0x0000000000001fF3684f28c67538d4D072C22734;
    
    // Treasury state
    uint256 public totalTreasuryETH;
    
    // Fee configuration (basis points, 50 = 0.5%)
    uint256 public depositFeeBps = 50;
    uint256 public withdrawFeeBps = 50;
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // Initial rate: 1 ETH = 1,000,000 SUITE (when treasury is empty)
    uint256 public constant INITIAL_RATE = 1_000_000 * 1e18;
    
    // Accumulated fees
    uint256 public accumulatedFees;
    
    // Events
    event DepositedETH(address indexed user, uint256 ethAmount, uint256 suiteMinted);
    event DepositedWithSwap(address indexed user, address token, uint256 tokenAmount, uint256 ethReceived, uint256 suiteMinted);
    event Withdrawn(address indexed user, uint256 suiteBurned, uint256 ethReturned);
    event FeesWithdrawn(address indexed to, uint256 amount);

    constructor(
        address _suiteToken,
        address _owner
    ) Ownable(_owner) {
        suiteToken = ISuiteToken(_suiteToken);
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
     * @dev Deposit any token using 0x swap
     * Frontend calls 0x API to get swapCalldata
     * @param sellToken Token being sold
     * @param sellAmount Amount of token to sell
     * @param swapCalldata Calldata from 0x API
     */
    function depositWithSwap(
        address sellToken,
        uint256 sellAmount,
        bytes calldata swapCalldata
    ) external nonReentrant {
        require(sellAmount > 0, "Amount must be > 0");
        require(sellToken != address(0), "Invalid token");
        
        // Transfer token from user
        IERC20(sellToken).safeTransferFrom(msg.sender, address(this), sellAmount);
        
        // Approve 0x to spend token
        IERC20(sellToken).approve(ZERO_X_EXCHANGE_PROXY, sellAmount);
        
        // Record ETH balance before swap
        uint256 ethBefore = address(this).balance;
        
        // Execute 0x swap (token → ETH)
        (bool success, ) = ZERO_X_EXCHANGE_PROXY.call(swapCalldata);
        require(success, "0x swap failed");
        
        // Calculate ETH received
        uint256 ethReceived = address(this).balance - ethBefore;
        require(ethReceived > 0, "No ETH received from swap");
        
        // Calculate fee
        uint256 fee = (ethReceived * depositFeeBps) / BPS_DENOMINATOR;
        uint256 netETH = ethReceived - fee;
        accumulatedFees += fee;
        
        // Calculate SUITE to mint
        uint256 suiteToMint = _calculateMint(netETH);
        
        // Update treasury
        totalTreasuryETH += netETH;
        
        // Mint SUITE
        suiteToken.mint(msg.sender, suiteToMint);
        
        emit DepositedWithSwap(msg.sender, sellToken, sellAmount, ethReceived, suiteToMint);
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
     * @dev Receive ETH (for swaps and direct sends)
     */
    receive() external payable {}
}
