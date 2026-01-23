// Swap API Library
// Uses 0x API for optimal swap quotes across DEXs
// Falls back to simulated quotes if API unavailable
// Supports Ethereum, Base, Arbitrum, Optimism

import { ethers } from 'ethers';
import { SUPPORTED_CHAINS, TokenInfo, COMMON_TOKENS } from './wallet';

// 0x API endpoints per chain (no KYC required!)
const ZEROX_API_ENDPOINTS: Record<number, string> = {
    1: 'https://api.0x.org',       // Ethereum
    8453: 'https://base.api.0x.org', // Base
    42161: 'https://arbitrum.api.0x.org', // Arbitrum
    10: 'https://optimism.api.0x.org', // Optimism
    137: 'https://polygon.api.0x.org', // Polygon
};

// Wrapped native token addresses per chain
const WRAPPED_NATIVE_TOKENS: Record<number, string> = {
    1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',     // WETH on Ethereum
    8453: '0x4200000000000000000000000000000000000006',   // WETH on Base
    42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
    10: '0x4200000000000000000000000000000000000006',     // WETH on Optimism
    137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',    // WPOL on Polygon
};

// Optional 0x API key (free tier available without key for limited requests)
const ZEROX_API_KEY = process.env.EXPO_PUBLIC_ZEROX_API_KEY || '';

export interface SwapQuote {
    fromToken: TokenInfo;
    toToken: TokenInfo;
    fromAmount: string;
    toAmount: string;
    toAmountFormatted: string;
    estimatedGas: string;
    priceImpact: string;
    protocols: string[];
}

export interface SwapTransaction {
    from: string;
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
}

// Get swap quote from 0x API
export async function getSwapQuote(
    chainId: number,
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string,
    slippage: number = 1 // 1%
): Promise<SwapQuote | null> {
    try {
        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            return null;
        }

        // Special case: Native <-> Wrapped is a wrap/unwrap, not a swap
        // Works for ETH/WETH on Ethereum/L2s and POL/WPOL on Polygon
        const isFromNative = fromToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ||
            fromToken.symbol === 'ETH' || fromToken.symbol === 'POL';
        const isToNative = toToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ||
            toToken.symbol === 'ETH' || toToken.symbol === 'POL';
        const isFromWrapped = fromToken.symbol === 'WETH' || fromToken.symbol === 'WPOL';
        const isToWrapped = toToken.symbol === 'WETH' || toToken.symbol === 'WPOL';

        if ((isFromNative && isToWrapped) || (isFromWrapped && isToNative)) {
            // Return 1:1 quote for wrap/unwrap
            const toAmount = ethers.utils.parseUnits(amount, toToken.decimals).toString();
            const contractName = chainId === 137 ? 'WPOL Contract' : 'WETH Contract';
            return {
                fromToken,
                toToken,
                fromAmount: amount,
                toAmount,
                toAmountFormatted: amount,
                estimatedGas: '45000', // Wrap is cheap
                priceImpact: '0%',
                protocols: [contractName],
            };
        }

        const apiBase = ZEROX_API_ENDPOINTS[chainId];
        if (!apiBase) {
            console.log('Chain not supported by 0x, using simulated quote');
            return getSimulatedQuote(fromToken, toToken, amount);
        }

        // Convert amount to wei
        const amountWei = ethers.utils.parseUnits(amount, fromToken.decimals).toString();

        // For native token, use wrapped token address for 0x (chain-specific)
        const wrappedNative = WRAPPED_NATIVE_TOKENS[chainId] || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
        const sellToken = fromToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            ? wrappedNative
            : fromToken.address;
        const buyToken = toToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            ? wrappedNative
            : toToken.address;

        // Build quote URL
        const url = `${apiBase}/swap/v1/price?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${amountWei}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };
        if (ZEROX_API_KEY) {
            headers['0x-api-key'] = ZEROX_API_KEY;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            console.log('0x API response:', errorText);
            // Return simulated quote for demo
            return getSimulatedQuote(fromToken, toToken, amount);
        }

        const data = await response.json();

        const toAmountFormatted = ethers.utils.formatUnits(data.buyAmount, toToken.decimals);

        return {
            fromToken,
            toToken,
            fromAmount: amount,
            toAmount: data.buyAmount,
            toAmountFormatted,
            estimatedGas: data.estimatedGas?.toString() || '250000',
            priceImpact: data.estimatedPriceImpact || '0.1%',
            protocols: data.sources?.filter((s: any) => s.proportion > 0).map((s: any) => s.name) || ['0x'],
        };
    } catch (error) {
        console.error('Error fetching swap quote:', error);
        // Return simulated quote for demo purposes
        return getSimulatedQuote(fromToken, toToken, amount);
    }
}

// Simulated quote for demo/fallback
function getSimulatedQuote(fromToken: TokenInfo, toToken: TokenInfo, amount: string): SwapQuote {
    // Simple price simulation based on token pairs
    let rate = 1;

    // ETH/WETH price pairs
    if ((fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH') &&
        (toToken.symbol === 'USDC' || toToken.symbol === 'USDT')) {
        rate = 2350; // ETH/USD approximate price
    } else if ((fromToken.symbol === 'USDC' || fromToken.symbol === 'USDT') &&
        (toToken.symbol === 'ETH' || toToken.symbol === 'WETH')) {
        rate = 1 / 2350;
    } else if (fromToken.symbol === 'ETH' && toToken.symbol === 'WETH') {
        rate = 1; // 1:1 for wrapping
    } else if (fromToken.symbol === 'WETH' && toToken.symbol === 'ETH') {
        rate = 1; // 1:1 for unwrapping  
    } else if (fromToken.symbol === 'POL' && toToken.symbol === 'WPOL') {
        rate = 1; // 1:1 for wrapping POL
    } else if (fromToken.symbol === 'WPOL' && toToken.symbol === 'POL') {
        rate = 1; // 1:1 for unwrapping WPOL
    } else if ((fromToken.symbol === 'POL' || fromToken.symbol === 'WPOL') &&
        (toToken.symbol === 'USDC' || toToken.symbol === 'USDT')) {
        rate = 0.45; // POL/USD approximate price
    } else if ((fromToken.symbol === 'USDC' || fromToken.symbol === 'USDT') &&
        (toToken.symbol === 'POL' || toToken.symbol === 'WPOL')) {
        rate = 1 / 0.45; // USD/POL
    } else if ((fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH') && toToken.symbol === 'WBTC') {
        rate = 0.055; // ~ETH/BTC price
    } else if (fromToken.symbol === 'WBTC' && (toToken.symbol === 'ETH' || toToken.symbol === 'WETH')) {
        rate = 18; // ~BTC/ETH price
    } else if ((fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH') && toToken.symbol === 'DAI') {
        rate = 2350;
    } else if (toToken.symbol === 'DAI' && (fromToken.symbol === 'ETH' || fromToken.symbol === 'WETH')) {
        rate = 1 / 2350;
    } else if (fromToken.symbol === 'USDC' && toToken.symbol === 'USDT') {
        rate = 1;
    } else if (fromToken.symbol === 'USDT' && toToken.symbol === 'USDC') {
        rate = 1;
    }

    const fromAmountNum = parseFloat(amount);
    const toAmountNum = fromAmountNum * rate * 0.997; // 0.3% fee
    const toAmountFormatted = toAmountNum.toFixed(toToken.decimals > 6 ? 6 : toToken.decimals);
    const toAmount = ethers.utils.parseUnits(toAmountFormatted, toToken.decimals).toString();

    return {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount,
        toAmountFormatted,
        estimatedGas: '250000',
        priceImpact: '0.1%',
        protocols: ['Uniswap V3', 'Curve'],
    };
}

// Calculate price impact (simplified)
function calculatePriceImpact(fromAmount: string, toAmount: string, fromToken: TokenInfo, toToken: TokenInfo): string {
    // This would normally compare to market price
    // For now, return a small simulated impact
    const impact = Math.random() * 0.5; // 0-0.5%
    return `${impact.toFixed(2)}%`;
}

// Build swap transaction (for actual execution)
export async function buildSwapTransaction(
    chainId: number,
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amount: string,
    fromAddress: string,
    slippage: number = 1
): Promise<SwapTransaction | null> {
    try {
        const amountWei = ethers.utils.parseUnits(amount, fromToken.decimals).toString();

        // Get the wrapped native token address for this chain
        const wrappedNativeAddress = WRAPPED_NATIVE_TOKENS[chainId] || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

        // Special case: Native <-> Wrapped wrap/unwrap (ETH/WETH, POL/WPOL)
        const isFromNative = fromToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ||
            fromToken.symbol === 'ETH' || fromToken.symbol === 'POL';
        const isToNative = toToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' ||
            toToken.symbol === 'ETH' || toToken.symbol === 'POL';
        const isFromWrapped = fromToken.symbol === 'WETH' || fromToken.symbol === 'WPOL';
        const isToWrapped = toToken.symbol === 'WETH' || toToken.symbol === 'WPOL';

        if (isFromNative && isToWrapped) {
            // Wrap native -> wrapped: call deposit() on wrapped contract
            return {
                from: fromAddress,
                to: wrappedNativeAddress,
                data: '0xd0e30db0', // deposit() function selector
                value: amountWei,
                gasLimit: '50000',
                gasPrice: '0',
            };
        }

        if (isFromWrapped && isToNative) {
            // Unwrap wrapped -> native: call withdraw(uint256) on wrapped contract
            // Convert amount to hex and pad to 32 bytes (64 hex chars)
            const amountHex = BigInt(amountWei).toString(16).padStart(64, '0');
            const withdrawData = '0x2e1a7d4d' + amountHex;
            console.log('📤 Building unwrap tx. Amount:', amount, 'AmountWei:', amountWei, 'Data:', withdrawData);
            return {
                from: fromAddress,
                to: wrappedNativeAddress,
                data: withdrawData,
                value: '0',
                gasLimit: '60000',
                gasPrice: '0',
            };
        }

        const apiBase = ZEROX_API_ENDPOINTS[chainId];
        if (!apiBase) {
            console.log('Chain not supported by 0x');
            return null;
        }

        // For other swaps, use 0x API with chain-specific wrapped token
        const sellToken = fromToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            ? wrappedNativeAddress
            : fromToken.address;
        const buyToken = toToken.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
            ? wrappedNativeAddress
            : toToken.address;

        const url = `${apiBase}/swap/v1/quote?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${amountWei}&takerAddress=${fromAddress}&slippagePercentage=${slippage / 100}`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };
        if (ZEROX_API_KEY) {
            headers['0x-api-key'] = ZEROX_API_KEY;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            console.error('0x swap API error:', await response.text());
            return null;
        }

        const data = await response.json();

        return {
            from: fromAddress,
            to: data.to,
            data: data.data,
            value: data.value,
            gasLimit: data.gas?.toString() || '300000',
            gasPrice: data.gasPrice || '0',
        };
    } catch (error) {
        console.error('Error building swap transaction:', error);
        return null;
    }
}

// Get tokens for a chain
export function getTokensForChain(chainId: number): TokenInfo[] {
    return COMMON_TOKENS[chainId] || [];
}

// Format amount with proper decimals for display
export function formatTokenAmount(amount: string, decimals: number): string {
    try {
        const num = parseFloat(amount);
        if (num === 0) return '0';
        if (num < 0.0001) return '<0.0001';
        if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
        return num.toFixed(Math.min(decimals, 6));
    } catch {
        return '0';
    }
}
