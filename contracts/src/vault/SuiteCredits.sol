// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SuiteCredits
 * @notice Non-redeemable utility token for SUITE ecosystem
 * @dev ONE-WAY token - can be created by burning SUITE, CANNOT be redeemed
 *
 * Key properties:
 * - Minted when users burn SUITE via vault.burnForCredits()
 * - Spent in SUITE apps (SUITEHub, Cadence, etc.)
 * - NOT redeemable for USDC or any other asset
 * - Legally similar to game currency (V-Bucks, Robux)
 * - Standard ERC20 - transferable between users
 *
 * Why this is legally cleaner:
 * - Credits have no redemption path to fiat/crypto
 * - They're purely utility tokens for app features
 * - Similar to prepaid service credits
 */
contract SuiteCredits is ERC20, Ownable {
    /// @notice Address of the vault that can mint credits
    address public vault;

    /// @notice Mapping of authorized apps that can spend credits
    mapping(address => bool) public authorizedApps;

    /// @notice Error when caller is not the vault
    error OnlyVault();

    /// @notice Error when caller is not an authorized app
    error OnlyAuthorizedApp();

    /// @notice Error when address is zero
    error ZeroAddress();

    /// @notice Error when user has insufficient credits
    error InsufficientCredits();

    /// @notice Emitted when an app is authorized
    event AppAuthorized(address indexed app);

    /// @notice Emitted when an app is deauthorized
    event AppDeauthorized(address indexed app);

    /// @notice Emitted when the vault address is updated
    event VaultUpdated(address indexed oldVault, address indexed newVault);

    /// @notice Emitted when credits are spent in an app
    event CreditsSpent(address indexed user, address indexed app, uint256 amount);

    /**
     * @notice Restricts function to vault contract only
     */
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    /**
     * @notice Restricts function to authorized apps only
     */
    modifier onlyAuthorizedApp() {
        if (!authorizedApps[msg.sender]) revert OnlyAuthorizedApp();
        _;
    }

    /**
     * @notice Creates the SUITE Credits token
     * @param _vault Address of the vault contract
     * @param _owner Address of the contract owner
     */
    constructor(address _vault, address _owner)
        ERC20("SUITE Credits", "sCREDITS")
        Ownable(_owner)
    {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
    }

    /**
     * @notice Mint new credits (vault only)
     * @dev Called when users burn SUITE for credits
     * @param to Address to receive the credits
     * @param amount Amount of credits to mint
     */
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /**
     * @notice Spend credits for app features (authorized apps only)
     * @dev Burns credits from user's balance
     * @param user Address to deduct credits from
     * @param amount Amount of credits to spend
     */
    function spendCredits(address user, uint256 amount) external onlyAuthorizedApp {
        if (balanceOf(user) < amount) revert InsufficientCredits();
        _burn(user, amount);
        emit CreditsSpent(user, msg.sender, amount);
    }

    /**
     * @notice Allow users to burn their own credits
     * @dev Useful for promotional burns or cleaning up
     * @param amount Amount of credits to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Authorize an app to spend user credits
     * @param app Address of the app to authorize
     */
    function authorizeApp(address app) external onlyOwner {
        if (app == address(0)) revert ZeroAddress();
        authorizedApps[app] = true;
        emit AppAuthorized(app);
    }

    /**
     * @notice Remove an app's authorization
     * @param app Address of the app to deauthorize
     */
    function deauthorizeApp(address app) external onlyOwner {
        authorizedApps[app] = false;
        emit AppDeauthorized(app);
    }

    /**
     * @notice Update the vault address
     * @dev Only for emergency/migration scenarios
     * @param newVault Address of the new vault
     */
    function setVault(address newVault) external onlyOwner {
        if (newVault == address(0)) revert ZeroAddress();
        address oldVault = vault;
        vault = newVault;
        emit VaultUpdated(oldVault, newVault);
    }

    /**
     * @notice Returns the number of decimals (18)
     * @return decimals Number of decimal places
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
