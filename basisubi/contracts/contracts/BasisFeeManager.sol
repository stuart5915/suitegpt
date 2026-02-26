// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title BasisFeeManager — Fee Distribution for Basis Vault
/// @notice Receives USDC performance fees from BasisVault.
///         Splits between manager wallet (operations) and buyback wallet
///         (for INCLAWNCH buyback → distribute to $BASIS stakers).
///         UUPS upgradeable — can add on-chain INCLAWNCH buyback later.
contract BasisFeeManager is
    Initializable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    IERC20 public usdc;
    address public admin;
    address public managerWallet;   // receives manager's cut in USDC
    address public buybackWallet;   // receives buyback portion (admin swaps to INCLAWNCH)
    uint256 public managerBps;      // e.g. 5000 = 50% to manager, 50% to buyback

    bool public upgradeRenounced;

    // Stats
    uint256 public totalFeesReceived;
    uint256 public totalToManager;
    uint256 public totalToBuyback;

    // Reserve storage slots for future upgrades
    uint256[50] private __gap;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event FeesDistributed(uint256 total, uint256 toManager, uint256 toBuyback);
    event ManagerWalletUpdated(address indexed newWallet);
    event BuybackWalletUpdated(address indexed newWallet);
    event FeeSplitUpdated(uint256 managerBps);
    event AdminTransferred(address indexed oldAdmin, address indexed newAdmin);
    event UpgradeRenounced();

    // ══════════════════════════════════════════════════════════════
    //  MODIFIERS
    // ══════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(msg.sender == admin, "not admin");
        _;
    }

    // ══════════════════════════════════════════════════════════════
    //  INITIALIZER
    // ══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _usdc,
        address _admin,
        address _managerWallet,
        address _buybackWallet,
        uint256 _managerBps
    ) external initializer {
        require(_usdc != address(0), "zero usdc");
        require(_admin != address(0), "zero admin");
        require(_managerWallet != address(0), "zero manager");
        require(_buybackWallet != address(0), "zero buyback");
        require(_managerBps <= 10000, "bps > 100%");

        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        usdc = IERC20(_usdc);
        admin = _admin;
        managerWallet = _managerWallet;
        buybackWallet = _buybackWallet;
        managerBps = _managerBps;
    }

    function version() external pure returns (uint256) { return 1; }

    // ══════════════════════════════════════════════════════════════
    //  PERMISSIONLESS — DISTRIBUTE
    // ══════════════════════════════════════════════════════════════

    /// @notice Distribute all accumulated USDC fees.
    ///         Anyone can call this — no special permissions needed.
    function distributeFees() external nonReentrant {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "no fees");

        uint256 managerAmount = (balance * managerBps) / 10000;
        uint256 buybackAmount = balance - managerAmount;

        totalFeesReceived += balance;

        if (managerAmount > 0) {
            totalToManager += managerAmount;
            usdc.safeTransfer(managerWallet, managerAmount);
        }

        if (buybackAmount > 0) {
            totalToBuyback += buybackAmount;
            usdc.safeTransfer(buybackWallet, buybackAmount);
        }

        emit FeesDistributed(balance, managerAmount, buybackAmount);
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN — SETTINGS
    // ══════════════════════════════════════════════════════════════

    function setManagerWallet(address wallet) external onlyAdmin {
        require(wallet != address(0), "zero address");
        managerWallet = wallet;
        emit ManagerWalletUpdated(wallet);
    }

    function setBuybackWallet(address wallet) external onlyAdmin {
        require(wallet != address(0), "zero address");
        buybackWallet = wallet;
        emit BuybackWalletUpdated(wallet);
    }

    function setFeeSplit(uint256 _managerBps) external onlyAdmin {
        require(_managerBps <= 10000, "bps > 100%");
        managerBps = _managerBps;
        emit FeeSplitUpdated(_managerBps);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice Rescue tokens accidentally sent to contract.
    function recoverToken(address token) external onlyAdmin {
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(admin, bal);
    }

    // ══════════════════════════════════════════════════════════════
    //  UUPS UPGRADE CONTROL
    // ══════════════════════════════════════════════════════════════

    function _authorizeUpgrade(address) internal view override {
        require(msg.sender == admin, "not admin");
        require(!upgradeRenounced, "upgrades renounced");
    }

    function renounceUpgradeability() external onlyAdmin {
        upgradeRenounced = true;
        emit UpgradeRenounced();
    }
}
