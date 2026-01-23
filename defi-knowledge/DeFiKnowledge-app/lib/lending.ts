// Aave V3 Lending Library for Polygon
// Provides functions for: Supply, Borrow, Repay, Withdraw

import { ethers } from 'ethers';

// Aave V3 Contract Addresses on Polygon
export const AAVE_V3_POLYGON = {
    // Main Pool contract
    POOL: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',
    // Pool Data Provider (for getting user data)
    POOL_DATA_PROVIDER: '0x69FA688f1Dc47d4B5d8029D5a35FB7a548310654',
    // UI Incentives Data Provider
    UI_INCENTIVES_DATA_PROVIDER: '0x874313A46e4957D29FaC3f49F7d53bb8b7f6dba3',
    // Wrapped Native Token (WMATIC/WPOL)
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    // Wrapped Token Gateway - use this for native POL supply/withdraw
    WRAPPED_TOKEN_GATEWAY: '0x1e4b7A6b903680eab0c5dAbcb8fD429cD2a9598c',
    // POL is native, use address(0) for ETH-like behavior or WMATIC
    NATIVE_TOKEN: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
};

// Common tokens on Polygon with Aave support
export const POLYGON_AAVE_TOKENS = {
    MATIC: { symbol: 'MATIC', address: AAVE_V3_POLYGON.WMATIC, decimals: 18, aToken: '0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97' },
    USDC: { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, aToken: '0x625E7708f30Ca75bfd92586e17077590C60eb4cD' },
    USDT: { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, aToken: '0x6ab707Aca953eDAeFBc4fD23bA73294241490620' },
    DAI: { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, aToken: '0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE' },
    WETH: { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, aToken: '0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8' },
    WBTC: { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, aToken: '0x078f358208685046a11C85e8ad32895DED33A249' },
};

// Aave Pool ABI (only the functions we need)
const POOL_ABI = [
    // Supply (deposit)
    'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
    // Withdraw
    'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
    // Borrow
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
    // Repay
    'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)',
    // Get user account data
    'function getUserAccountData(address user) external view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

// ERC20 ABI for approvals
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)',
];

// Pool Data Provider ABI
const POOL_DATA_PROVIDER_ABI = [
    'function getUserReserveData(address asset, address user) external view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)',
    'function getReserveData(address asset) external view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
];

// Wrapped Token Gateway ABI - for depositing/withdrawing native POL
const WRAPPED_TOKEN_GATEWAY_ABI = [
    // Deposit native token (POL/MATIC)
    'function depositETH(address pool, address onBehalfOf, uint16 referralCode) external payable',
    // Withdraw native token
    'function withdrawETH(address pool, uint256 amount, address to) external',
    // Borrow native token
    'function borrowETH(address pool, uint256 amount, uint256 interestRateMode, uint16 referralCode) external',
    // Repay native token
    'function repayETH(address pool, uint256 amount, uint256 interestRateMode, address onBehalfOf) external payable',
];

// Interest rate modes
export const INTEREST_RATE_MODE = {
    STABLE: 1,
    VARIABLE: 2,
};

// User position data
export interface UserPosition {
    totalCollateralUSD: string;
    totalDebtUSD: string;
    availableBorrowsUSD: string;
    liquidationThreshold: string;
    ltv: string;
    healthFactor: string;
}

// Asset position data
export interface AssetPosition {
    supplied: string;
    suppliedUSD: string;
    borrowed: string;
    borrowedUSD: string;
    supplyAPY: string;
    borrowAPY: string;
    isCollateral: boolean;
}

// Get provider for Polygon
function getPolygonProvider(): ethers.providers.JsonRpcProvider {
    const provider = new ethers.providers.JsonRpcProvider('https://polygon-rpc.com');
    // Set a reasonable timeout for RPC calls
    provider.pollingInterval = 5000;
    return provider;
}

// Get user account data (overall position)
export async function getUserAccountData(userAddress: string): Promise<UserPosition> {
    try {
        const provider = getPolygonProvider();
        const poolContract = new ethers.Contract(AAVE_V3_POLYGON.POOL, POOL_ABI, provider);

        const data = await poolContract.getUserAccountData(userAddress);

        return {
            totalCollateralUSD: ethers.utils.formatUnits(data.totalCollateralBase, 8), // Aave uses 8 decimals for USD values
            totalDebtUSD: ethers.utils.formatUnits(data.totalDebtBase, 8),
            availableBorrowsUSD: ethers.utils.formatUnits(data.availableBorrowsBase, 8),
            liquidationThreshold: (data.currentLiquidationThreshold.toNumber() / 100).toFixed(2) + '%',
            ltv: (data.ltv.toNumber() / 100).toFixed(2) + '%',
            healthFactor: data.healthFactor.eq(ethers.constants.MaxUint256)
                ? '∞'
                : parseFloat(ethers.utils.formatUnits(data.healthFactor, 18)).toFixed(2),
        };
    } catch (error) {
        console.error('Error fetching user account data:', error);
        throw error;
    }
}

// Get user position for a specific asset
export async function getUserAssetPosition(userAddress: string, assetAddress: string): Promise<AssetPosition | null> {
    try {
        const provider = getPolygonProvider();
        const dataProvider = new ethers.Contract(AAVE_V3_POLYGON.POOL_DATA_PROVIDER, POOL_DATA_PROVIDER_ABI, provider);

        const [userData, reserveData] = await Promise.all([
            dataProvider.getUserReserveData(assetAddress, userAddress),
            dataProvider.getReserveData(assetAddress),
        ]);

        // Find token info
        const tokenInfo = Object.values(POLYGON_AAVE_TOKENS).find(t => t.address.toLowerCase() === assetAddress.toLowerCase());
        const decimals = tokenInfo?.decimals || 18;

        // Calculate APYs from rates (ray = 27 decimals)
        const supplyAPY = (parseFloat(ethers.utils.formatUnits(reserveData.liquidityRate, 27)) * 100).toFixed(2);
        const borrowAPY = (parseFloat(ethers.utils.formatUnits(reserveData.variableBorrowRate, 27)) * 100).toFixed(2);

        const supplied = ethers.utils.formatUnits(userData.currentATokenBalance, decimals);
        const borrowed = ethers.utils.formatUnits(userData.currentVariableDebt, decimals);

        return {
            supplied,
            suppliedUSD: '0', // Would need price oracle for accurate USD value
            borrowed,
            borrowedUSD: '0',
            supplyAPY: supplyAPY + '%',
            borrowAPY: borrowAPY + '%',
            isCollateral: userData.usageAsCollateralEnabled,
        };
    } catch (error) {
        console.error('Error fetching asset position:', error);
        return null;
    }
}

// Build supply transaction
// For native POL: use Wrapped Token Gateway and send amount as value
// For ERC20 tokens: use Pool.supply with token approval
export async function buildSupplyTransaction(
    assetAddress: string,
    amount: string,
    decimals: number,
    userAddress: string
): Promise<{ to: string; data: string; value: string }> {
    const amountWei = ethers.utils.parseUnits(amount, decimals);

    // Check if this is native POL (WMATIC address)
    if (assetAddress.toLowerCase() === AAVE_V3_POLYGON.WMATIC.toLowerCase()) {
        // Use Wrapped Token Gateway for native POL
        const gatewayInterface = new ethers.utils.Interface(WRAPPED_TOKEN_GATEWAY_ABI);
        const data = gatewayInterface.encodeFunctionData('depositETH', [
            AAVE_V3_POLYGON.POOL,  // pool address
            userAddress,            // onBehalfOf
            0,                      // referral code
        ]);

        return {
            to: AAVE_V3_POLYGON.WRAPPED_TOKEN_GATEWAY,
            data,
            value: amountWei.toHexString(), // Send native POL as msg.value
        };
    }

    // For ERC20 tokens, use the regular Pool.supply
    const poolInterface = new ethers.utils.Interface(POOL_ABI);
    const data = poolInterface.encodeFunctionData('supply', [
        assetAddress,
        amountWei,
        userAddress,
        0, // referral code
    ]);

    return {
        to: AAVE_V3_POLYGON.POOL,
        data,
        value: '0x0',
    };
}

// Build borrow transaction
export async function buildBorrowTransaction(
    assetAddress: string,
    amount: string,
    decimals: number,
    userAddress: string,
    interestRateMode: number = INTEREST_RATE_MODE.VARIABLE
): Promise<{ to: string; data: string; value: string }> {
    const poolInterface = new ethers.utils.Interface(POOL_ABI);
    const amountWei = ethers.utils.parseUnits(amount, decimals);

    const data = poolInterface.encodeFunctionData('borrow', [
        assetAddress,
        amountWei,
        interestRateMode,
        0, // referral code
        userAddress,
    ]);

    return {
        to: AAVE_V3_POLYGON.POOL,
        data,
        value: '0x0',
    };
}

// Build repay transaction
export async function buildRepayTransaction(
    assetAddress: string,
    amount: string,
    decimals: number,
    userAddress: string,
    interestRateMode: number = INTEREST_RATE_MODE.VARIABLE
): Promise<{ to: string; data: string; value: string }> {
    const poolInterface = new ethers.utils.Interface(POOL_ABI);
    const amountWei = ethers.utils.parseUnits(amount, decimals);

    const data = poolInterface.encodeFunctionData('repay', [
        assetAddress,
        amountWei,
        interestRateMode,
        userAddress,
    ]);

    return {
        to: AAVE_V3_POLYGON.POOL,
        data,
        value: '0x0',
    };
}

// Build withdraw transaction
export async function buildWithdrawTransaction(
    assetAddress: string,
    amount: string,
    decimals: number,
    userAddress: string
): Promise<{ to: string; data: string; value: string }> {
    const poolInterface = new ethers.utils.Interface(POOL_ABI);
    const amountWei = ethers.utils.parseUnits(amount, decimals);

    const data = poolInterface.encodeFunctionData('withdraw', [
        assetAddress,
        amountWei,
        userAddress,
    ]);

    return {
        to: AAVE_V3_POLYGON.POOL,
        data,
        value: '0x0',
    };
}

// Build approval transaction
export async function buildApprovalTransaction(
    tokenAddress: string,
    amount: string,
    decimals: number
): Promise<{ to: string; data: string; value: string }> {
    const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
    const amountWei = ethers.utils.parseUnits(amount, decimals);

    const data = erc20Interface.encodeFunctionData('approve', [
        AAVE_V3_POLYGON.POOL,
        amountWei,
    ]);

    return {
        to: tokenAddress,
        data,
        value: '0x0',
    };
}

// Check if approval is needed
// Native POL (WMATIC address when supplying) doesn't need approval - sent as msg.value
export async function checkNeedsApproval(
    tokenAddress: string,
    userAddress: string,
    amount: string,
    decimals: number
): Promise<boolean> {
    try {
        // Native POL doesn't need approval - it's sent as msg.value via Gateway
        if (tokenAddress.toLowerCase() === AAVE_V3_POLYGON.WMATIC.toLowerCase()) {
            return false;
        }

        const provider = getPolygonProvider();
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        const allowance = await tokenContract.allowance(userAddress, AAVE_V3_POLYGON.POOL);
        const amountWei = ethers.utils.parseUnits(amount, decimals);

        return allowance.lt(amountWei);
    } catch (error) {
        console.error('Error checking approval:', error);
        return true; // Assume approval needed on error
    }
}

// Get token balance
// For MATIC/POL, get native balance; for others, get ERC20 balance
export async function getTokenBalance(
    tokenAddress: string,
    userAddress: string,
    decimals: number
): Promise<string> {
    try {
        const provider = getPolygonProvider();

        // Check if this is the native MATIC/POL token (WMATIC address)
        if (tokenAddress.toLowerCase() === AAVE_V3_POLYGON.WMATIC.toLowerCase()) {
            // Get native POL balance
            const balance = await provider.getBalance(userAddress);
            return ethers.utils.formatUnits(balance, 18);
        }

        // Otherwise get ERC20 balance
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const balance = await tokenContract.balanceOf(userAddress);
        return ethers.utils.formatUnits(balance, decimals);
    } catch (error) {
        console.error('Error fetching token balance:', error);
        return '0';
    }
}
