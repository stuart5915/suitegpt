// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title OddsClawVault — ODDS token vault for prediction markets
/// @notice Players deposit ODDS → server credits off-chain balance (1:1 ratio).
/// @dev 1 ODDS token (1e18) = 1 off-chain ODDS. Server is source of truth for balances.
contract OddsClawVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable oddsToken;
    address public admin;
    address public operator; // server wallet — processes withdrawals

    uint256 public constant TOKEN_DECIMALS = 1e18;
    uint256 public constant MIN_DEPOSIT = 10 * 1e18; // 10 ODDS minimum

    bool public paused;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalHouseDeposited;
    mapping(address => uint256) public playerTotalDeposited;
    mapping(address => uint256) public playerTotalWithdrawn;
    mapping(address => uint256) public withdrawNonce;

    event Deposit(address indexed player, uint256 tokenAmount, uint256 credits);
    event Withdraw(address indexed player, uint256 tokenAmount, uint256 credits, uint256 nonce);
    event HouseDeposit(address indexed from, uint256 tokenAmount);
    event AdminWithdraw(address indexed to, uint256 tokenAmount);
    event OperatorUpdated(address indexed oldOperator, address indexed newOperator);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event Paused(bool isPaused);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Not operator");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paused");
        _;
    }

    constructor(address _oddsToken, address _operator) {
        require(_oddsToken != address(0), "Invalid token");
        require(_operator != address(0), "Invalid operator");
        oddsToken = IERC20(_oddsToken);
        admin = msg.sender;
        operator = _operator;
    }

    // =========== Player Functions ===========

    /// @notice Deposit ODDS tokens — server credits off-chain balance via Deposit event
    function deposit(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(tokenAmount >= MIN_DEPOSIT, "Min 10 ODDS");

        oddsToken.safeTransferFrom(msg.sender, address(this), tokenAmount);

        uint256 credits = tokenAmount / TOKEN_DECIMALS;
        totalDeposited += tokenAmount;
        playerTotalDeposited[msg.sender] += tokenAmount;

        emit Deposit(msg.sender, tokenAmount, credits);
    }

    // =========== Operator Functions ===========

    /// @notice Process a player withdrawal — only callable by server operator
    function processWithdraw(address player, uint256 credits) external onlyOperator nonReentrant whenNotPaused {
        require(player != address(0), "Invalid player");
        require(credits > 0, "Zero credits");

        uint256 tokenAmount = credits * TOKEN_DECIMALS;
        require(oddsToken.balanceOf(address(this)) >= tokenAmount, "Insufficient vault balance");

        uint256 nonce = withdrawNonce[player];
        withdrawNonce[player] = nonce + 1;
        totalWithdrawn += tokenAmount;
        playerTotalWithdrawn[player] += tokenAmount;

        oddsToken.safeTransfer(player, tokenAmount);

        emit Withdraw(player, tokenAmount, credits, nonce);
    }

    // =========== Admin Functions ===========

    /// @notice Fund the house pool with ODDS tokens (admin deposits for platform agents)
    function depositHousePool(uint256 tokenAmount) external onlyAdmin nonReentrant {
        require(tokenAmount > 0, "Zero amount");
        oddsToken.safeTransferFrom(msg.sender, address(this), tokenAmount);
        totalHouseDeposited += tokenAmount;
        emit HouseDeposit(msg.sender, tokenAmount);
    }

    /// @notice Withdraw excess ODDS tokens
    function adminWithdraw(uint256 tokenAmount) external onlyAdmin nonReentrant {
        require(tokenAmount > 0, "Zero amount");
        require(oddsToken.balanceOf(address(this)) >= tokenAmount, "Insufficient balance");
        oddsToken.safeTransfer(admin, tokenAmount);
        emit AdminWithdraw(admin, tokenAmount);
    }

    /// @notice Update the operator (server) wallet
    function setOperator(address _operator) external onlyAdmin {
        require(_operator != address(0), "Invalid operator");
        emit OperatorUpdated(operator, _operator);
        operator = _operator;
    }

    /// @notice Emergency pause — blocks deposits and withdrawals
    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
        emit Paused(_paused);
    }

    /// @notice Transfer admin role
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // =========== View Functions ===========

    function creditsToTokens(uint256 credits) external pure returns (uint256) {
        return credits * TOKEN_DECIMALS;
    }

    function tokensToCredits(uint256 tokenAmount) external pure returns (uint256) {
        return tokenAmount / TOKEN_DECIMALS;
    }

    function vaultBalance() external view returns (uint256) {
        return oddsToken.balanceOf(address(this));
    }

    function vaultBalanceCredits() external view returns (uint256) {
        return oddsToken.balanceOf(address(this)) / TOKEN_DECIMALS;
    }

    function playerStats(address player) external view returns (
        uint256 deposited,
        uint256 withdrawn,
        uint256 nonce
    ) {
        return (playerTotalDeposited[player], playerTotalWithdrawn[player], withdrawNonce[player]);
    }
}
