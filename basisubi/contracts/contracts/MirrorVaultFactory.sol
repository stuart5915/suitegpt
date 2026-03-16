// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./MirrorVault.sol";

/// @title MirrorVaultFactory — Deploy Mirror Vaults
/// @notice Creates BeaconProxy mirror vaults for the Basis Mirror Marketplace.
///         First vault per wallet is free. Additional vaults require burning
///         BASIS tokens. All Base mainnet addresses are stored in the factory
///         so creators only pick a name, fee, and tracked position.
contract MirrorVaultFactory is Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    // ══════════════════════════════════════════════════════════════
    //  ERRORS
    // ══════════════════════════════════════════════════════════════

    error NameTooShort();
    error FeeTooHigh();
    error DepositCapTooLow();
    error MustBurnBasis();
    error TrackedWalletZero();
    error FactoryPaused();

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    UpgradeableBeacon public beacon;

    // Fixed Base mainnet addresses
    address public immutable usdc;
    address public immutable weth;
    address public immutable positionManager;
    address public immutable swapRouter;
    address public immutable aeroPool;   // ETH/USDC CL pool

    // BASIS token (burn-to-create)
    IERC20 public basisToken;
    uint256 public burnPerVault;        // tokens burned per extra vault (adjustable)
    uint256 public freeVaultLimit;      // free vaults per wallet (adjustable, starts at 1)
    uint256 public totalBurned;         // total BASIS burned via vault creation

    // Fee manager (optional, can be address(0) for no fees)
    address public feeManager;

    // Registry
    address[] public allVaults;
    mapping(address => address[]) public vaultsByCreator;
    mapping(address => bool) public isVault;
    uint256 public vaultCount;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event VaultCreated(
        address indexed vault,
        address indexed creator,
        string name,
        address trackedWallet,
        uint256 trackedTokenId,
        uint256 performanceFeeBps,
        uint256 depositCap,
        uint256 basisBurned,
        uint256 index
    );
    event BurnAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event FreeVaultLimitUpdated(uint256 oldLimit, uint256 newLimit);
    event BasisTokenUpdated(address oldToken, address newToken);
    event FeeManagerUpdated(address oldFeeManager, address newFeeManager);

    // ══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    struct FactoryParams {
        address implementation;   // MirrorVault implementation address
        address usdc_;
        address weth_;
        address positionManager_;
        address swapRouter_;
        address aeroPool_;
        address basisToken_;      // address(0) if not launched yet
        address feeManager_;      // address(0) for no fees
        uint256 burnPerVault_;    // e.g. 1000e18 = 1000 BASIS
        uint256 freeVaultLimit_;  // e.g. 1
    }

    constructor(FactoryParams memory p) Ownable(msg.sender) Pausable() {
        beacon = new UpgradeableBeacon(p.implementation, address(this));

        usdc = p.usdc_;
        weth = p.weth_;
        positionManager = p.positionManager_;
        swapRouter = p.swapRouter_;
        aeroPool = p.aeroPool_;
        basisToken = IERC20(p.basisToken_);
        feeManager = p.feeManager_;
        burnPerVault = p.burnPerVault_;
        freeVaultLimit = p.freeVaultLimit_;
    }

    // ══════════════════════════════════════════════════════════════
    //  CREATE VAULT
    // ══════════════════════════════════════════════════════════════

    /// @notice Create a new mirror vault.
    /// @param name_               Vault display name
    /// @param performanceFeeBps_  Performance fee in bps (max 3000 = 30%)
    /// @param depositCap_         Max USDC deposits (6 decimals)
    /// @param trackedWallet_      Wallet whose LP position to mirror
    /// @param trackedTokenId_     Specific NFT token ID to track (0 = set later)
    function createVault(
        string calldata name_,
        uint256 performanceFeeBps_,
        uint256 depositCap_,
        address trackedWallet_,
        uint256 trackedTokenId_
    ) external whenNotPaused returns (address vault) {
        if (bytes(name_).length < 3) revert NameTooShort();
        if (performanceFeeBps_ > 3000) revert FeeTooHigh();
        if (depositCap_ < 100e6) revert DepositCapTooLow();
        if (trackedWallet_ == address(0)) revert TrackedWalletZero();

        // Burn-to-create: first N vaults free, then burn BASIS
        uint256 burned = 0;
        uint256 existingVaults = vaultsByCreator[msg.sender].length;
        if (existingVaults >= freeVaultLimit && burnPerVault > 0) {
            if (address(basisToken) == address(0)) revert MustBurnBasis();
            // Transfer BASIS to dead address (burn)
            burned = burnPerVault;
            basisToken.safeTransferFrom(msg.sender, address(0xdead), burned);
            totalBurned += burned;
        }

        vaultCount++;
        string memory symbol = string(abi.encodePacked("bm-", _uint2str(vaultCount)));

        // Encode init data
        bytes memory initData = abi.encodeCall(
            MirrorVault.initialize,
            (MirrorVault.VaultInitParams({
                usdc: usdc,
                weth_: weth,
                positionManager_: positionManager,
                swapRouter_: swapRouter,
                pool_: aeroPool,
                admin_: msg.sender,
                factory_: address(this),
                feeManager_: feeManager,
                depositCap_: depositCap_,
                performanceFeeBps_: performanceFeeBps_,
                name_: name_,
                symbol_: symbol
            }))
        );

        // Deploy BeaconProxy
        vault = address(new BeaconProxy(address(beacon), initData));

        // Set tracked position on the new vault
        if (trackedTokenId_ != 0) {
            MirrorVault(vault).setTrackedPosition(trackedWallet_, trackedTokenId_);
        }

        // Register
        allVaults.push(vault);
        vaultsByCreator[msg.sender].push(vault);
        isVault[vault] = true;

        emit VaultCreated(
            vault, msg.sender, name_,
            trackedWallet_, trackedTokenId_,
            performanceFeeBps_, depositCap_,
            burned, vaultCount
        );
    }

    // ══════════════════════════════════════════════════════════════
    //  VIEWS
    // ══════════════════════════════════════════════════════════════

    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    function getVaults(uint256 offset, uint256 limit) external view returns (address[] memory) {
        uint256 len = allVaults.length;
        if (offset >= len) return new address[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = allVaults[i];
        }
        return result;
    }

    function getCreatorVaults(address creator) external view returns (address[] memory) {
        return vaultsByCreator[creator];
    }

    /// @notice How many more free vaults this wallet can create
    function freeVaultsRemaining(address creator) external view returns (uint256) {
        uint256 existing = vaultsByCreator[creator].length;
        if (existing >= freeVaultLimit) return 0;
        return freeVaultLimit - existing;
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════════════

    function setBurnAmount(uint256 newAmount) external onlyOwner {
        emit BurnAmountUpdated(burnPerVault, newAmount);
        burnPerVault = newAmount;
    }

    function setFreeVaultLimit(uint256 newLimit) external onlyOwner {
        emit FreeVaultLimitUpdated(freeVaultLimit, newLimit);
        freeVaultLimit = newLimit;
    }

    function setBasisToken(address newToken) external onlyOwner {
        emit BasisTokenUpdated(address(basisToken), newToken);
        basisToken = IERC20(newToken);
    }

    function setFeeManager(address newFeeManager) external onlyOwner {
        emit FeeManagerUpdated(feeManager, newFeeManager);
        feeManager = newFeeManager;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Upgrade all mirror vaults to a new implementation
    function upgradeImplementation(address newImpl) external onlyOwner {
        beacon.upgradeTo(newImpl);
    }

    // ══════════════════════════════════════════════════════════════
    //  INTERNAL
    // ══════════════════════════════════════════════════════════════

    function _uint2str(uint256 val) internal pure returns (string memory) {
        if (val == 0) return "0";
        uint256 temp = val;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (val != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + val % 10));
            val /= 10;
        }
        return string(buffer);
    }
}
