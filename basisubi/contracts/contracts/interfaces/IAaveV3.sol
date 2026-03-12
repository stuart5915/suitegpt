// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Aave V3 Pool Interface (subset needed for AutoBasisVault)
interface IAaveV3Pool {
    /// @notice Supply an asset to the pool
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /// @notice Withdraw an asset from the pool
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /// @notice Borrow an asset from the pool (variable rate = 2)
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    /// @notice Repay a borrowed asset
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /// @notice Get user account data
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

/// @title Aave V3 aToken interface (for balance checks)
interface IAToken {
    function balanceOf(address account) external view returns (uint256);
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}

/// @title Aave V3 variable debt token interface
interface IVariableDebtToken {
    function balanceOf(address account) external view returns (uint256);
    function UNDERLYING_ASSET_ADDRESS() external view returns (address);
}
