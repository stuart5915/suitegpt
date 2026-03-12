// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MarketplaceVault.sol";

/// @title BasisVaultFactory — Deploy Marketplace Vaults
/// @notice Creates BeaconProxy vaults for the Basis Vault Marketplace.
///         Anyone can create a vault. The factory stores all Base mainnet
///         addresses so vault creators only need to choose name + fee.
contract BasisVaultFactory is Ownable {

    // ══════════════════════════════════════════════════════════════
    //  ERRORS
    // ══════════════════════════════════════════════════════════════

    error FeeTooHigh();
    error CreationFeeTooLow();
    error NameTooShort();
    error DepositCapTooLow();

    // ══════════════════════════════════════════════════════════════
    //  STATE
    // ══════════════════════════════════════════════════════════════

    UpgradeableBeacon public beacon;

    // Fixed Base mainnet addresses (set once in constructor)
    address public immutable usdc;
    address public immutable weth;
    address public immutable positionManager;
    address public immutable swapRouter;
    address public immutable aeroPool;
    address public immutable aavePool;
    address public immutable aWeth;
    address public immutable aUsdc;
    address public immutable vDebtUsdc;
    address public immutable vDebtWeth;

    // Vault creation fee (in ETH, goes to factory owner for spam prevention)
    uint256 public creationFee;

    // Registry
    address[] public allVaults;
    mapping(address => address[]) public vaultsByManager;
    mapping(address => bool) public isVault;

    // Counter for unique symbols
    uint256 public vaultCount;

    // ══════════════════════════════════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════════════════════════════════

    event VaultCreated(
        address indexed vault,
        address indexed manager,
        string name,
        uint256 performanceFeeBps,
        uint256 depositCap,
        uint256 index
    );
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);

    // ══════════════════════════════════════════════════════════════
    //  CONSTRUCTOR
    // ══════════════════════════════════════════════════════════════

    struct FactoryParams {
        address implementation;  // MarketplaceVault implementation address
        address usdc_;
        address weth_;
        address positionManager_;
        address swapRouter_;
        address aeroPool_;
        address aavePool_;
        address aWeth_;
        address aUsdc_;
        address vDebtUsdc_;
        address vDebtWeth_;
        uint256 creationFee_;    // in wei (ETH)
    }

    constructor(FactoryParams memory p) Ownable(msg.sender) {
        // Deploy the beacon pointing to the implementation
        beacon = new UpgradeableBeacon(p.implementation, address(this));

        usdc = p.usdc_;
        weth = p.weth_;
        positionManager = p.positionManager_;
        swapRouter = p.swapRouter_;
        aeroPool = p.aeroPool_;
        aavePool = p.aavePool_;
        aWeth = p.aWeth_;
        aUsdc = p.aUsdc_;
        vDebtUsdc = p.vDebtUsdc_;
        vDebtWeth = p.vDebtWeth_;
        creationFee = p.creationFee_;
    }

    // ══════════════════════════════════════════════════════════════
    //  CREATE VAULT
    // ══════════════════════════════════════════════════════════════

    /// @notice Create a new vault. Anyone can call this.
    /// @param name_       Vault display name (e.g. "Alpha Brain Vault")
    /// @param performanceFeeBps_  Manager's performance fee in bps (max 3000 = 30%)
    /// @param depositCap_         Max USDC deposits (6 decimals)
    function createVault(
        string calldata name_,
        uint256 performanceFeeBps_,
        uint256 depositCap_
    ) external payable returns (address vault) {
        if (bytes(name_).length < 3) revert NameTooShort();
        if (performanceFeeBps_ > 3000) revert FeeTooHigh();
        if (depositCap_ < 100e6) revert DepositCapTooLow(); // min $100
        if (msg.value < creationFee) revert CreationFeeTooLow();

        vaultCount++;

        // Generate unique symbol: bv-1, bv-2, etc.
        string memory symbol = string(abi.encodePacked("bv-", _uint2str(vaultCount)));

        // Encode init data
        bytes memory initData = abi.encodeCall(
            MarketplaceVault.initialize,
            (MarketplaceVault.VaultInitParams({
                usdc: usdc,
                weth_: weth,
                positionManager_: positionManager,
                swapRouter_: swapRouter,
                aeroPool_: aeroPool,
                aavePool_: aavePool,
                aWeth_: aWeth,
                aUsdc_: aUsdc,
                vDebtUsdc_: vDebtUsdc,
                vDebtWeth_: vDebtWeth,
                manager_: msg.sender,
                factory_: address(this),
                depositCap_: depositCap_,
                performanceFeeBps_: performanceFeeBps_,
                name_: name_,
                symbol_: symbol
            }))
        );

        // Deploy BeaconProxy
        vault = address(new BeaconProxy(address(beacon), initData));

        // Register
        allVaults.push(vault);
        vaultsByManager[msg.sender].push(vault);
        isVault[vault] = true;

        emit VaultCreated(vault, msg.sender, name_, performanceFeeBps_, depositCap_, vaultCount);
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

    function getManagerVaults(address mgr) external view returns (address[] memory) {
        return vaultsByManager[mgr];
    }

    // ══════════════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════════════

    function setCreationFee(uint256 newFee) external onlyOwner {
        emit CreationFeeUpdated(creationFee, newFee);
        creationFee = newFee;
    }

    /// @notice Upgrade all vaults to a new implementation
    function upgradeImplementation(address newImpl) external onlyOwner {
        beacon.upgradeTo(newImpl);
    }

    function withdrawFees() external onlyOwner {
        (bool ok,) = owner().call{value: address(this).balance}("");
        require(ok);
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

    receive() external payable {}
}
