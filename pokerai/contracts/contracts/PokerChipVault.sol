// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PokerChipVault — USDC vault for PokerAI with rake revenue split
/// @notice Players deposit USDC → server credits chips. Rake splits between two recipients.
/// @dev Chip ratio: 1 USDC (1e6) = 10,000 chips. Server is source of truth for chip balances.
contract PokerChipVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public admin;
    address public operator; // server wallet — processes withdrawals + records rake

    uint256 public constant CHIPS_PER_USDC = 10_000;
    uint256 public constant USDC_DECIMALS = 1e6;
    uint256 public constant MIN_DEPOSIT = 100_000; // 0.10 USDC

    bool public paused;
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalHouseDeposited;
    mapping(address => uint256) public playerTotalDeposited;
    mapping(address => uint256) public playerTotalWithdrawn;
    mapping(address => uint256) public withdrawNonce;

    // === Rake Revenue Split ===
    address public rakeRecipient1;          // inclawbate.base.eth (set at deploy)
    address public rakeRecipient2;          // partner (set later by admin)
    uint8 public rakeSplit1 = 100;          // % to recipient1 (0-100), rest to recipient2
    uint256 public unclaimedRake1;          // USDC owed to recipient1
    uint256 public unclaimedRake2;          // USDC owed to recipient2
    uint256 public totalRakeRecorded;       // lifetime rake in USDC

    event Deposit(address indexed player, uint256 usdcAmount, uint256 chips);
    event Withdraw(address indexed player, uint256 usdcAmount, uint256 chips, uint256 nonce);
    event HouseDeposit(address indexed from, uint256 usdcAmount);
    event AdminWithdraw(address indexed to, uint256 usdcAmount);
    event RakeRecorded(uint256 usdcAmount, uint256 share1, uint256 share2);
    event RakeClaimed(address indexed recipient, uint256 usdcAmount);
    event RakeSplitUpdated(uint8 pct1, uint8 pct2);
    event RakeRecipient2Updated(address indexed recipient);
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

    constructor(address _usdc, address _operator, address _rakeRecipient1) {
        require(_usdc != address(0), "Invalid USDC");
        require(_operator != address(0), "Invalid operator");
        require(_rakeRecipient1 != address(0), "Invalid rake recipient");
        usdc = IERC20(_usdc);
        admin = msg.sender;
        operator = _operator;
        rakeRecipient1 = _rakeRecipient1;
    }

    // =========== Player Functions ===========

    /// @notice Deposit USDC to receive chips (credited by server via Deposit event)
    function deposit(uint256 usdcAmount) external nonReentrant whenNotPaused {
        require(usdcAmount >= MIN_DEPOSIT, "Min 0.10 USDC");

        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);

        uint256 chips = (usdcAmount * CHIPS_PER_USDC) / USDC_DECIMALS;
        totalDeposited += usdcAmount;
        playerTotalDeposited[msg.sender] += usdcAmount;

        emit Deposit(msg.sender, usdcAmount, chips);
    }

    // =========== Operator Functions ===========

    /// @notice Process a player withdrawal — only callable by server operator
    function processWithdraw(address player, uint256 chips) external onlyOperator nonReentrant whenNotPaused {
        require(player != address(0), "Invalid player");
        require(chips > 0, "Zero chips");

        uint256 usdcAmount = (chips * USDC_DECIMALS) / CHIPS_PER_USDC;
        require(usdcAmount > 0, "Amount too small");
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient vault balance");

        uint256 nonce = withdrawNonce[player];
        withdrawNonce[player] = nonce + 1;
        totalWithdrawn += usdcAmount;
        playerTotalWithdrawn[player] += usdcAmount;

        usdc.safeTransfer(player, usdcAmount);

        emit Withdraw(player, usdcAmount, chips, nonce);
    }

    /// @notice Record rake earned from poker hands — splits between recipients
    /// @param usdcAmount Rake amount in USDC smallest units (server converts chips → USDC)
    function recordRake(uint256 usdcAmount) external onlyOperator {
        require(usdcAmount > 0, "Zero rake");

        uint256 share1 = (usdcAmount * rakeSplit1) / 100;
        uint256 share2 = usdcAmount - share1;

        // If no recipient2 set, everything goes to recipient1
        if (rakeRecipient2 == address(0)) {
            share1 = usdcAmount;
            share2 = 0;
        }

        unclaimedRake1 += share1;
        unclaimedRake2 += share2;
        totalRakeRecorded += usdcAmount;

        emit RakeRecorded(usdcAmount, share1, share2);
    }

    /// @notice Claim accumulated rake — callable by either rake recipient
    function claimRake() external nonReentrant {
        uint256 amount;

        if (msg.sender == rakeRecipient1) {
            amount = unclaimedRake1;
            require(amount > 0, "Nothing to claim");
            require(usdc.balanceOf(address(this)) >= amount, "Insufficient vault balance");
            unclaimedRake1 = 0;
            usdc.safeTransfer(rakeRecipient1, amount);
        } else if (msg.sender == rakeRecipient2) {
            amount = unclaimedRake2;
            require(amount > 0, "Nothing to claim");
            require(usdc.balanceOf(address(this)) >= amount, "Insufficient vault balance");
            unclaimedRake2 = 0;
            usdc.safeTransfer(rakeRecipient2, amount);
        } else {
            revert("Not a rake recipient");
        }

        emit RakeClaimed(msg.sender, amount);
    }

    // =========== Admin Functions ===========

    /// @notice Fund the house pool with USDC (admin deposits for house bots to play with)
    function depositHousePool(uint256 usdcAmount) external onlyAdmin nonReentrant {
        require(usdcAmount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        totalHouseDeposited += usdcAmount;
        emit HouseDeposit(msg.sender, usdcAmount);
    }

    /// @notice Withdraw excess USDC (house pool management — NOT rake, use claimRake for that)
    function adminWithdraw(uint256 usdcAmount) external onlyAdmin nonReentrant {
        require(usdcAmount > 0, "Zero amount");
        require(usdc.balanceOf(address(this)) >= usdcAmount, "Insufficient balance");
        usdc.safeTransfer(admin, usdcAmount);
        emit AdminWithdraw(admin, usdcAmount);
    }

    /// @notice Update rake recipient 1 (inclawbate wallet)
    function setRakeRecipient1(address _recipient) external onlyAdmin {
        require(_recipient != address(0), "Invalid recipient");
        rakeRecipient1 = _recipient;
    }

    /// @notice Set the second rake recipient (partner wallet)
    function setRakeRecipient2(address _recipient) external onlyAdmin {
        rakeRecipient2 = _recipient; // address(0) means all rake goes to recipient1
        emit RakeRecipient2Updated(_recipient);
    }

    /// @notice Update the rake split — pct1 + pct2 must equal 100
    function setRakeSplit(uint8 pct1, uint8 pct2) external onlyAdmin {
        require(pct1 + pct2 == 100, "Must total 100");
        rakeSplit1 = pct1;
        emit RakeSplitUpdated(pct1, pct2);
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

    function chipsToUsdc(uint256 chips) external pure returns (uint256) {
        return (chips * USDC_DECIMALS) / CHIPS_PER_USDC;
    }

    function usdcToChips(uint256 usdcAmount) external pure returns (uint256) {
        return (usdcAmount * CHIPS_PER_USDC) / USDC_DECIMALS;
    }

    function vaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function playerStats(address player) external view returns (
        uint256 deposited,
        uint256 withdrawn,
        uint256 nonce
    ) {
        return (playerTotalDeposited[player], playerTotalWithdrawn[player], withdrawNonce[player]);
    }

    function rakeInfo() external view returns (
        address recipient1,
        address recipient2,
        uint8 splitPct1,
        uint256 unclaimed1,
        uint256 unclaimed2,
        uint256 totalRecorded
    ) {
        return (rakeRecipient1, rakeRecipient2, rakeSplit1, unclaimedRake1, unclaimedRake2, totalRakeRecorded);
    }
}
