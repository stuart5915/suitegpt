// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title SuiteShareToken
 * @notice ERC20 token representing shares in the SUITE Yield Vault
 * @dev Only the vault contract can mint/burn tokens
 *
 * Key properties:
 * - Represents proportional ownership of vault's Yearn position
 * - Value accrues as Yearn generates yield
 * - Can be redeemed for underlying assets (USDC)
 * - Can be burned for Credits (one-way, non-redeemable)
 * - Standard ERC20 - transferable between users
 */
contract SuiteShareToken is ERC20, ERC20Permit {
    /// @notice Address of the vault that can mint/burn tokens
    address public immutable vault;

    /// @notice Error when caller is not the vault
    error OnlyVault();

    /// @notice Error when vault address is zero
    error ZeroVaultAddress();

    /**
     * @notice Restricts function to vault contract only
     */
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    /**
     * @notice Creates the SUITE share token
     * @param _vault Address of the vault contract
     */
    constructor(address _vault)
        ERC20("SUITE Vault Share", "SUITE")
        ERC20Permit("SUITE Vault Share")
    {
        if (_vault == address(0)) revert ZeroVaultAddress();
        vault = _vault;
    }

    /**
     * @notice Mint new shares (vault only)
     * @param to Address to receive the shares
     * @param amount Amount of shares to mint
     */
    function mint(address to, uint256 amount) external onlyVault {
        _mint(to, amount);
    }

    /**
     * @notice Burn shares from an address (vault only)
     * @dev Used for withdrawals and credit conversion
     * @param from Address to burn shares from
     * @param amount Amount of shares to burn
     */
    function burn(address from, uint256 amount) external onlyVault {
        _burn(from, amount);
    }

    /**
     * @notice Returns the number of decimals (18)
     * @return decimals Number of decimal places
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
