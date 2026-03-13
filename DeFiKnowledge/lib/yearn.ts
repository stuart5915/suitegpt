// Yearn Finance API Integration
// Fetches vault data (APY, TVL, assets) and user positions

export interface YearnVault {
    address: string;
    name: string;
    symbol: string;
    displayName: string;
    icon?: string;
    token: {
        address: string;
        name: string;
        symbol: string;
        decimals: number;
    };
    apy: {
        net: number; // Net APY after fees
        gross: number;
    };
    tvl: {
        value: number; // USD value
        formatted: string;
    };
    risk: 'low' | 'medium' | 'high';
    chainId: number;
}

export interface YearnUserPosition {
    vaultAddress: string;
    balance: string; // User's vault token balance
    balanceUSD: number;
    depositedAmount: string; // Original token amount deposited
    earnedAmount: string; // Profit earned
}

// Yearn API base URL (using the public API that works with mobile/CORS)
const YEARN_API_BASE = 'https://ydaemon.yearn.fi';

// Risk classification based on vault type/strategy
function classifyRisk(vault: any): 'low' | 'medium' | 'high' {
    const apyNet = vault.apy?.net_apy || 0;
    const vaultType = vault.type || '';

    // High APY = Higher risk generally
    if (apyNet > 0.15) return 'high';
    if (apyNet > 0.08) return 'medium';

    // Stablecoin vaults are generally low risk
    if (vaultType.includes('stable') || vault.token.symbol.match(/USD|DAI/i)) {
        return 'low';
    }

    return 'medium';
}

// Format large numbers for TVL display
function formatTVL(value: number): string {
    if (value >= 1_000_000_000) {
        return `$${(value / 1_000_000_000).toFixed(2)}B`;
    }
    if (value >= 1_000_000) {
        return `$${(value / 1_000_000).toFixed(2)}M`;
    }
    if (value >= 1_000) {
        return `$${(value / 1_000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
}

/**
 * Fetch top Yearn vaults by TVL
 */
export async function fetchTopVaults(chainId: number = 1, limit: number = 5): Promise<YearnVault[]> {
    try {
        // yDaemon API format: /1/vaults/all (chainId/vaults/all)
        const response = await fetch(`${YEARN_API_BASE}/${chainId}/vaults/all`);

        if (!response.ok) {
            throw new Error(`Yearn API error: ${response.status}`);
        }

        const vaults = await response.json();

        // Transform and filter vaults
        const transformedVaults: YearnVault[] = vaults
            .filter((v: any) => v.tvl?.totalAssets > 0 && (v.apr?.netAPR > 0 || v.apr?.forwardAPR?.netAPR > 0))
            .map((v: any) => ({
                address: v.address,
                name: v.name,
                symbol: v.symbol,
                displayName: v.displayName || v.name,
                icon: v.token?.icon,
                token: {
                    address: v.token?.address || '',
                    name: v.token?.name || v.name,
                    symbol: v.token?.symbol || v.symbol,
                    decimals: v.token?.decimals || 18,
                },
                apy: {
                    net: v.apr?.forwardAPR?.netAPR || v.apr?.netAPR || 0,
                    gross: v.apr?.forwardAPR?.grossAPR || v.apr?.extra?.stakingRewardsAPR || 0,
                },
                tvl: {
                    value: v.tvl?.totalAssets || 0,
                    formatted: formatTVL(v.tvl?.tvl || v.tvl?.totalAssets || 0),
                },
                risk: classifyRisk(v),
                chainId,
            }))
            .sort((a: YearnVault, b: YearnVault) => b.tvl.value - a.tvl.value)
            .slice(0, limit);

        return transformedVaults;
    } catch (error) {
        console.error('Error fetching Yearn vaults:', error);
        // Return fallback mock data if API fails
        return getMockVaults();
    }
}

/**
 * Fetch user's positions in Yearn vaults
 */
export async function fetchUserPositions(
    userAddress: string,
    chainId: number = 1
): Promise<YearnUserPosition[]> {
    try {
        const response = await fetch(
            `${YEARN_API_BASE}/chains/${chainId}/accounts/${userAddress}/vaults/balances`
        );

        if (!response.ok) {
            throw new Error(`Yearn API error: ${response.status}`);
        }

        const positions = await response.json();

        return positions
            .filter((p: any) => parseFloat(p.balance) > 0)
            .map((p: any) => ({
                vaultAddress: p.vault.address,
                balance: p.balance,
                balanceUSD: p.balanceUSD || 0,
                depositedAmount: p.deposited || '0',
                earnedAmount: p.earned || '0',
            }));
    } catch (error) {
        console.error('Error fetching user positions:', error);
        return [];
    }
}

/**
 * Mock data for when API is unavailable or for testing
 */
function getMockVaults(): YearnVault[] {
    return [
        {
            address: '0x7Da96a3891Add058AdA2E826306D812C638D87a8',
            name: 'USDC Vault',
            symbol: 'yvUSDC',
            displayName: 'USDC yVault',
            token: {
                address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                name: 'USD Coin',
                symbol: 'USDC',
                decimals: 6,
            },
            apy: {
                net: 0.0523,
                gross: 0.0612,
            },
            tvl: {
                value: 245_000_000,
                formatted: '$245.00M',
            },
            risk: 'low',
            chainId: 1,
        },
        {
            address: '0xa258C4606Ca8206D8aA700cE2143D7db854D168c',
            name: 'ETH Vault',
            symbol: 'yvETH',
            displayName: 'ETH yVault',
            token: {
                address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
                name: 'Wrapped Ether',
                symbol: 'WETH',
                decimals: 18,
            },
            apy: {
                net: 0.0387,
                gross: 0.0451,
            },
            tvl: {
                value: 512_000_000,
                formatted: '$512.00M',
            },
            risk: 'low',
            chainId: 1,
        },
        {
            address: '0xdA816459F1AB5631232FE5e97a05BBBb94970c95',
            name: 'DAI Vault',
            symbol: 'yvDAI',
            displayName: 'DAI yVault',
            token: {
                address: '0x6b175474e89094c44da98b954eedeac495271d0f',
                name: 'Dai Stablecoin',
                symbol: 'DAI',
                decimals: 18,
            },
            apy: {
                net: 0.0445,
                gross: 0.0521,
            },
            tvl: {
                value: 128_000_000,
                formatted: '$128.00M',
            },
            risk: 'low',
            chainId: 1,
        },
    ];
}
