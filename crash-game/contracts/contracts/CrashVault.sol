// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CrashVault — CLAWS vault for Claws Crash game
/// @notice Players deposit CLAWS → server credits chips. House edge (1%) accumulates in vault.
/// @dev 1 CLAWS (1e18) = 1 chip. Server is source of truth for chip balances.
contract CrashVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable claws;
    address public admin;
    address public operator; // server wallet — processes withdrawals

    uint256 public constant CLAWS_DECIMALS = 1e18;
    uint256 public constant MIN_DEPOSIT = 10 * 1e18; // 10 CLAWS minimum

    bool public paused;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    mapping(address => uint256) public playerTotalDeposited;
    mapping(address => uint256) public playerTotalWithdrawn;
    mapping(address => uint256) public withdrawNonce;

    // === Revenue ===
    address public revenueWallet;
    uint256 public totalRevenueClaimed;

    event Deposit(address indexed player, uint256 clawsAmount, uint256 chips);
    event Withdraw(address indexed player, uint256 clawsAmount, uint256 chips, uint256 nonce);
    event RevenueClaimed(address indexed to, uint256 amount);
    event OperatorUpdated(address indexed oldOp, address indexed newOp);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event Paused(bool isPaused);

    modifier onlyAdmin() { require(msg.sender == admin, "Not admin"); _; }
    modifier onlyOperator() { require(msg.sender == operator, "Not operator"); _; }
    modifier whenNotPaused() { require(!paused, "Paused"); _; }

    constructor(address _claws, address _operator, address _revenueWallet) {
        require(_claws != address(0), "Invalid CLAWS");
        require(_operator != address(0), "Invalid operator");
        require(_revenueWallet != address(0), "Invalid revenue wallet");
        claws = IERC20(_claws);
        admin = msg.sender;
        operator = _operator;
        revenueWallet = _revenueWallet;
    }

    // =========== Player Functions ===========

    /// @notice Deposit CLAWS to receive chips (1 CLAWS = 1 chip)
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount >= MIN_DEPOSIT, "Min 10 CLAWS");

        claws.safeTransferFrom(msg.sender, address(this), amount);

        uint256 chips = amount / CLAWS_DECIMALS;
        totalDeposited += amount;
        playerTotalDeposited[msg.sender] += amount;

        emit Deposit(msg.sender, amount, chips);
    }

    // =========== Operator Functions ===========

    /// @notice Process a player withdrawal — only callable by server operator
    function processWithdraw(address player, uint256 chips) external onlyOperator nonReentrant whenNotPaused {
        require(player != address(0), "Invalid player");
        require(chips > 0, "Zero chips");

        uint256 clawsAmount = chips * CLAWS_DECIMALS;
        require(claws.balanceOf(address(this)) >= clawsAmount, "Insufficient vault");

        uint256 nonce = withdrawNonce[player];
        withdrawNonce[player] = nonce + 1;
        totalWithdrawn += clawsAmount;
        playerTotalWithdrawn[player] += clawsAmount;

        claws.safeTransfer(player, clawsAmount);

        emit Withdraw(player, clawsAmount, chips, nonce);
    }

    // =========== Admin Functions ===========

    /// @notice Claim house revenue — vault surplus above player deposits minus withdrawals
    function claimRevenue(uint256 amount) external onlyAdmin nonReentrant {
        require(amount > 0, "Zero amount");
        require(claws.balanceOf(address(this)) >= amount, "Insufficient balance");
        totalRevenueClaimed += amount;
        claws.safeTransfer(revenueWallet, amount);
        emit RevenueClaimed(revenueWallet, amount);
    }

    function setOperator(address _operator) external onlyAdmin {
        require(_operator != address(0), "Invalid operator");
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    function setRevenueWallet(address _wallet) external onlyAdmin {
        require(_wallet != address(0), "Invalid wallet");
        revenueWallet = _wallet;
    }

    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        emit Paused(_paused);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // =========== View Functions ===========

    function vaultBalance() external view returns (uint256) {
        return claws.balanceOf(address(this));
    }

    function playerStats(address player) external view returns (
        uint256 deposited, uint256 withdrawn, uint256 nonce
    ) {
        return (playerTotalDeposited[player], playerTotalWithdrawn[player], withdrawNonce[player]);
    }

    /// @notice House profit = vault balance - (totalDeposited - totalWithdrawn)
    function houseProfit() external view returns (int256) {
        uint256 bal = claws.balanceOf(address(this));
        uint256 playerFunds = totalDeposited > totalWithdrawn ? totalDeposited - totalWithdrawn : 0;
        return int256(bal) - int256(playerFunds);
    }
}
