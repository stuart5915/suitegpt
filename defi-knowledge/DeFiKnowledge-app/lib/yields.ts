// Yields Data - Curated pools and strategies
// Structured to accept community-voted content from website

// Simple pool - single deposit, start earning
export interface YieldPool {
    id: string;
    name: string;
    protocol: string;
    protocolEmoji: string;
    apy: string;
    apyValue: number; // For sorting
    risk: 'low' | 'medium' | 'high';
    network: string;
    type: 'stable' | 'staking' | 'lp' | 'vault';
    depositToken: string;
    description: string;
}

// Multi-step strategy
export interface YieldStrategy {
    id: string;
    name: string;
    totalApy: string;
    apyValue: number;
    risk: 'low' | 'medium' | 'high';
    votes: number; // From website community voting
    network: string;
    steps: {
        order: number;
        action: string;
        protocol: string;
        protocolEmoji: string;
        inputToken: string;
        outputToken: string;
        description: string;
    }[];
}

// Risk colors
export const RISK_COLORS = {
    low: '#22C55E',
    medium: '#F59E0B',
    high: '#EF4444',
};

// Initial curated pools - can be fetched from Supabase later
export const CURATED_POOLS: YieldPool[] = [
    {
        id: 'aave-usdc',
        name: 'USDC Lending',
        protocol: 'Aave',
        protocolEmoji: '👻',
        apy: '4.5%',
        apyValue: 4.5,
        risk: 'low',
        network: 'ethereum',
        type: 'stable',
        depositToken: 'USDC',
        description: 'Lend USDC and earn interest from borrowers',
    },
    {
        id: 'lido-eth',
        name: 'ETH Staking',
        protocol: 'Lido',
        protocolEmoji: '🔷',
        apy: '3.5%',
        apyValue: 3.5,
        risk: 'low',
        network: 'ethereum',
        type: 'staking',
        depositToken: 'ETH',
        description: 'Stake ETH and receive stETH that earns rewards',
    },
    {
        id: 'maker-dai',
        name: 'DAI Savings Rate',
        protocol: 'MakerDAO',
        protocolEmoji: '🟡',
        apy: '5.0%',
        apyValue: 5.0,
        risk: 'low',
        network: 'ethereum',
        type: 'stable',
        depositToken: 'DAI',
        description: 'Earn the DAI Savings Rate on your DAI',
    },
    {
        id: 'compound-usdt',
        name: 'USDT Lending',
        protocol: 'Compound',
        protocolEmoji: '🟢',
        apy: '3.8%',
        apyValue: 3.8,
        risk: 'low',
        network: 'ethereum',
        type: 'stable',
        depositToken: 'USDT',
        description: 'Supply USDT and earn from borrowers',
    },
    {
        id: 'beefy-eth',
        name: 'ETH Vault',
        protocol: 'Beefy',
        protocolEmoji: '🐄',
        apy: '5.2%',
        apyValue: 5.2,
        risk: 'medium',
        network: 'ethereum',
        type: 'vault',
        depositToken: 'ETH',
        description: 'Auto-compounding ETH yield strategy',
    },
    {
        id: 'quickswap-pol',
        name: 'POL/USDC LP',
        protocol: 'QuickSwap',
        protocolEmoji: '🐉',
        apy: '12%',
        apyValue: 12,
        risk: 'medium',
        network: 'polygon',
        type: 'lp',
        depositToken: 'POL + USDC',
        description: 'Provide liquidity and earn trading fees',
    },
    // Flare Network Pools
    {
        id: 'kinetic-eth',
        name: 'ETH Lending',
        protocol: 'Kinetic',
        protocolEmoji: '⚡',
        apy: '6.2%',
        apyValue: 6.2,
        risk: 'medium',
        network: 'flare',
        type: 'stable',
        depositToken: 'ETH',
        description: 'Lend ETH on Flare via Kinetic Exchange',
    },
    {
        id: 'kinetic-usdt0',
        name: 'USDT0 Lending',
        protocol: 'Kinetic',
        protocolEmoji: '⚡',
        apy: '8.5%',
        apyValue: 8.5,
        risk: 'medium',
        network: 'flare',
        type: 'stable',
        depositToken: 'USDT0',
        description: 'Lend USDT0 stablecoin on Kinetic',
    },
    {
        id: 'sparkdex-eth-usd',
        name: 'ETH/USD LP',
        protocol: 'SparkDEX',
        protocolEmoji: '✨',
        apy: '18%',
        apyValue: 18,
        risk: 'medium',
        network: 'flare',
        type: 'lp',
        depositToken: 'ETH + USD',
        description: 'Provide ETH/USD liquidity on SparkDEX',
    },
    {
        id: 'sparkdex-flr-usd',
        name: 'FLR/USD LP',
        protocol: 'SparkDEX',
        protocolEmoji: '✨',
        apy: '25%',
        apyValue: 25,
        risk: 'high',
        network: 'flare',
        type: 'lp',
        depositToken: 'FLR + USD',
        description: 'High-yield FLR/USD liquidity pool',
    },
];

// Initial curated strategies - multi-step flows
export const CURATED_STRATEGIES: YieldStrategy[] = [
    // 🔥 FEATURED: Flare Network DeFi Strategy
    {
        id: 'flare-kinetic-sparkdex',
        name: 'Flare Leveraged LP Strategy',
        totalApy: '32%',
        apyValue: 32,
        risk: 'high',
        votes: 487, // Featured strategy - top voted
        network: 'flare',
        steps: [
            {
                order: 1,
                action: 'Bridge',
                protocol: 'LayerZero',
                protocolEmoji: '🌉',
                inputToken: 'ETH (Ethereum)',
                outputToken: 'ETH (Flare)',
                description: 'Bridge ETH from Ethereum to Flare network',
            },
            {
                order: 2,
                action: 'Lend',
                protocol: 'Kinetic',
                protocolEmoji: '⚡',
                inputToken: 'ETH',
                outputToken: 'kETH (collateral)',
                description: 'Supply ETH as collateral on Kinetic Exchange',
            },
            {
                order: 3,
                action: 'Borrow',
                protocol: 'Kinetic',
                protocolEmoji: '⚡',
                inputToken: 'kETH collateral',
                outputToken: 'USDT0',
                description: 'Borrow USDT0 stablecoin against your ETH',
            },
            {
                order: 4,
                action: 'Provide LP',
                protocol: 'SparkDEX',
                protocolEmoji: '✨',
                inputToken: 'ETH + USDT0',
                outputToken: 'ETH/USD LP',
                description: 'Add liquidity to SparkDEX ETH/USD pool',
            },
        ],
    },
    {
        id: 'eth-steth-curve',
        name: 'ETH → stETH → Curve',
        totalApy: '7%',
        apyValue: 7,
        risk: 'medium',
        votes: 156,
        network: 'ethereum',
        steps: [
            {
                order: 1,
                action: 'Stake',
                protocol: 'Lido',
                protocolEmoji: '🔷',
                inputToken: 'ETH',
                outputToken: 'stETH',
                description: 'Stake ETH to receive stETH',
            },
            {
                order: 2,
                action: 'Deposit',
                protocol: 'Curve',
                protocolEmoji: '🌀',
                inputToken: 'stETH',
                outputToken: 'stETH/ETH LP',
                description: 'Add to stETH/ETH pool for extra yield',
            },
        ],
    },
    {
        id: 'usdc-aave-leverage',
        name: 'USDC Leveraged Lending',
        totalApy: '10%',
        apyValue: 10,
        risk: 'high',
        votes: 89,
        network: 'ethereum',
        steps: [
            {
                order: 1,
                action: 'Supply',
                protocol: 'Aave',
                protocolEmoji: '👻',
                inputToken: 'USDC',
                outputToken: 'aUSDC',
                description: 'Supply USDC as collateral',
            },
            {
                order: 2,
                action: 'Borrow',
                protocol: 'Aave',
                protocolEmoji: '👻',
                inputToken: 'aUSDC',
                outputToken: 'USDC',
                description: 'Borrow USDC against collateral',
            },
            {
                order: 3,
                action: 'Re-supply',
                protocol: 'Aave',
                protocolEmoji: '👻',
                inputToken: 'USDC',
                outputToken: 'aUSDC',
                description: 'Supply borrowed USDC for leverage',
            },
        ],
    },
    {
        id: 'pol-lp-farming',
        name: 'POL LP Farming',
        totalApy: '15%',
        apyValue: 15,
        risk: 'medium',
        votes: 234,
        network: 'polygon',
        steps: [
            {
                order: 1,
                action: 'Wrap',
                protocol: 'WPOL',
                protocolEmoji: '💜',
                inputToken: 'POL',
                outputToken: 'WPOL',
                description: 'Wrap POL for DeFi compatibility',
            },
            {
                order: 2,
                action: 'Provide LP',
                protocol: 'QuickSwap',
                protocolEmoji: '🐉',
                inputToken: 'WPOL + USDC',
                outputToken: 'LP Token',
                description: 'Add liquidity to earn fees + rewards',
            },
        ],
    },
    {
        id: 'stables-curve-convex',
        name: 'Stables → Curve → Convex',
        totalApy: '8%',
        apyValue: 8,
        risk: 'low',
        votes: 312,
        network: 'ethereum',
        steps: [
            {
                order: 1,
                action: 'Deposit',
                protocol: 'Curve',
                protocolEmoji: '🌀',
                inputToken: 'USDC/DAI/USDT',
                outputToken: '3pool LP',
                description: 'Deposit stablecoins to 3pool',
            },
            {
                order: 2,
                action: 'Stake',
                protocol: 'Convex',
                protocolEmoji: '⚡',
                inputToken: '3pool LP',
                outputToken: 'cvx3pool',
                description: 'Stake LP for boosted rewards',
            },
        ],
    },
    {
        id: 'eth-reth-yearn',
        name: 'ETH → rETH → Yearn',
        totalApy: '6%',
        apyValue: 6,
        risk: 'low',
        votes: 178,
        network: 'ethereum',
        steps: [
            {
                order: 1,
                action: 'Stake',
                protocol: 'Rocket Pool',
                protocolEmoji: '🚀',
                inputToken: 'ETH',
                outputToken: 'rETH',
                description: 'Stake ETH for rETH',
            },
            {
                order: 2,
                action: 'Deposit',
                protocol: 'Yearn',
                protocolEmoji: '🔵',
                inputToken: 'rETH',
                outputToken: 'yrETH',
                description: 'Auto-compound in Yearn vault',
            },
        ],
    },
];

// Get top voted strategies
export const getTopVotedStrategies = (limit: number = 5): YieldStrategy[] => {
    return [...CURATED_STRATEGIES].sort((a, b) => b.votes - a.votes).slice(0, limit);
};

// Get pools by type
export const getPoolsByType = (type: YieldPool['type']): YieldPool[] => {
    return CURATED_POOLS.filter(p => p.type === type);
};
