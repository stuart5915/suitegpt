// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IYearnVault
 * @notice Interface for Yearn V3 vault interaction
 * @dev Yearn V3 vaults implement ERC-4626 tokenized vault standard
 */
interface IYearnVault {
    /**
     * @notice Deposit assets and receive vault shares
     * @param assets Amount of underlying assets to deposit
     * @param receiver Address to receive the vault shares
     * @return shares Amount of vault shares minted
     */
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /**
     * @notice Withdraw assets by burning vault shares
     * @param assets Amount of underlying assets to withdraw
     * @param receiver Address to receive the withdrawn assets
     * @param owner Address that owns the vault shares being burned
     * @return shares Amount of vault shares burned
     */
    function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);

    /**
     * @notice Redeem vault shares for underlying assets
     * @param shares Amount of vault shares to redeem
     * @param receiver Address to receive the underlying assets
     * @param owner Address that owns the vault shares
     * @return assets Amount of underlying assets returned
     */
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

    /**
     * @notice Get the current price per share
     * @return The current price of one vault share in underlying assets (scaled by 1e18)
     */
    function pricePerShare() external view returns (uint256);

    /**
     * @notice Get the vault share balance of an account
     * @param account Address to query
     * @return Amount of vault shares owned
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @notice Get the underlying asset of the vault
     * @return Address of the underlying asset token
     */
    function asset() external view returns (address);

    /**
     * @notice Get total assets managed by the vault
     * @return Total amount of underlying assets
     */
    function totalAssets() external view returns (uint256);

    /**
     * @notice Convert assets to shares
     * @param assets Amount of assets to convert
     * @return shares Equivalent amount of shares
     */
    function convertToShares(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Convert shares to assets
     * @param shares Amount of shares to convert
     * @return assets Equivalent amount of assets
     */
    function convertToAssets(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Preview deposit amount
     * @param assets Amount of assets to deposit
     * @return shares Amount of shares that would be minted
     */
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Preview withdraw amount
     * @param assets Amount of assets to withdraw
     * @return shares Amount of shares that would be burned
     */
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    /**
     * @notice Preview redeem amount
     * @param shares Amount of shares to redeem
     * @return assets Amount of assets that would be returned
     */
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /**
     * @notice Get maximum deposit amount for a receiver
     * @param receiver Address that would receive shares
     * @return Maximum amount of assets that can be deposited
     */
    function maxDeposit(address receiver) external view returns (uint256);

    /**
     * @notice Get maximum withdraw amount for an owner
     * @param owner Address that owns shares
     * @return Maximum amount of assets that can be withdrawn
     */
    function maxWithdraw(address owner) external view returns (uint256);

    /**
     * @notice Get maximum redeem amount for an owner
     * @param owner Address that owns shares
     * @return Maximum amount of shares that can be redeemed
     */
    function maxRedeem(address owner) external view returns (uint256);

    /**
     * @notice Approve spender to transfer shares
     * @param spender Address to approve
     * @param amount Amount of shares to approve
     * @return success Whether approval succeeded
     */
    function approve(address spender, uint256 amount) external returns (bool success);

    /**
     * @notice Get allowance for spender
     * @param owner Owner of the shares
     * @param spender Spender address
     * @return Amount of shares spender is allowed to transfer
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @notice Get total supply of vault shares
     * @return Total supply of shares
     */
    function totalSupply() external view returns (uint256);
}
