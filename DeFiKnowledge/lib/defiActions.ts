// DeFi Actions Data
// Organized by ecosystem and category with educational explainers

export type RiskLevel = 'safe' | 'low' | 'medium';

export type Ecosystem = 'ethereum' | 'base' | 'optimism' | 'arbitrum' | 'polygon';

export type ActivityCategory = 'swapping' | 'lending' | 'staking' | 'bridging' | 'governance';

export interface EcosystemInfo {
    id: Ecosystem;
    name: string;
    color: string;
    icon: string;
}

export interface DeFiAction {
    id: string;
    name: string;
    protocol: string;
    category: ActivityCategory;
    ecosystems: Ecosystem[];
    risk: RiskLevel;
    url: string;
    description: string;
    explainer: {
        whatItDoes: string;
        howItWorks: string;
        fees: string;
        timeEstimate?: string;
        tips: string[];
    };
}

export interface CategoryInfo {
    id: ActivityCategory;
    name: string;
    emoji: string;
    description: string;
}

// Ecosystem definitions
export const ECOSYSTEMS: EcosystemInfo[] = [
    { id: 'ethereum', name: 'Ethereum', color: '#627EEA', icon: '🔷' },
    { id: 'base', name: 'Base', color: '#0052FF', icon: '🔵' },
    { id: 'optimism', name: 'Optimism', color: '#FF0420', icon: '🔴' },
    { id: 'arbitrum', name: 'Arbitrum', color: '#28A0F0', icon: '⚫' },
    { id: 'polygon', name: 'Polygon', color: '#8247E5', icon: '🟣' },
];

// Category definitions
export const CATEGORIES: CategoryInfo[] = [
    {
        id: 'swapping',
        name: 'Swapping',
        emoji: '📤',
        description: 'Exchange one token for another on decentralized exchanges'
    },
    {
        id: 'lending',
        name: 'Lending & Borrowing',
        emoji: '🏦',
        description: 'Deposit assets to earn interest or borrow against collateral'
    },
    {
        id: 'staking',
        name: 'Staking & Yield',
        emoji: '💎',
        description: 'Lock tokens to earn rewards and passive income'
    },
    {
        id: 'bridging',
        name: 'Bridging',
        emoji: '🌉',
        description: 'Move assets between different blockchains'
    },
    {
        id: 'governance',
        name: 'Governance',
        emoji: '🗳️',
        description: 'Vote on protocol decisions and shape the future of DeFi'
    },
];

// Risk level display info
export const RISK_INFO: Record<RiskLevel, { label: string; color: string; emoji: string }> = {
    safe: { label: 'No Risk', color: '#22C55E', emoji: '🟢' },
    low: { label: 'Low Risk', color: '#3B82F6', emoji: '🟡' },
    medium: { label: 'Medium Risk', color: '#F59E0B', emoji: '🟠' },
};

// All DeFi actions with educational content
export const DEFI_ACTIONS: DeFiAction[] = [
    // ============ SWAPPING ============
    {
        id: 'uniswap',
        name: 'Swap on Uniswap',
        protocol: 'Uniswap',
        category: 'swapping',
        ecosystems: ['ethereum', 'base', 'optimism', 'arbitrum', 'polygon'],
        risk: 'safe',
        url: 'https://app.uniswap.org/',
        description: 'The largest decentralized exchange by volume',
        explainer: {
            whatItDoes: 'Swap any token for another instantly. For example, exchange ETH for USDC or swap between any ERC-20 tokens.',
            howItWorks: 'Uniswap uses liquidity pools instead of order books. You trade against pooled liquidity provided by other users, and prices adjust automatically based on supply and demand.',
            fees: '0.3% swap fee (goes to liquidity providers) + network gas fee',
            tips: [
                'Check slippage settings before large trades',
                'Compare prices with other DEXs',
                'Avoid swapping during high gas periods'
            ]
        }
    },
    {
        id: '1inch',
        name: 'Swap on 1inch',
        protocol: '1inch',
        category: 'swapping',
        ecosystems: ['ethereum', 'base', 'optimism', 'arbitrum', 'polygon'],
        risk: 'safe',
        url: 'https://app.1inch.io/',
        description: 'DEX aggregator that finds the best swap rates',
        explainer: {
            whatItDoes: 'Finds the best price across multiple DEXs and routes your trade optimally. Often gets you better rates than using a single exchange.',
            howItWorks: '1inch searches Uniswap, Sushiswap, Curve, and 50+ other DEXs simultaneously, then splits your trade across them to minimize slippage and maximize returns.',
            fees: 'No protocol fee. Only pay the underlying DEX fees + gas',
            tips: [
                'Great for large trades that might have high slippage',
                'Compare the quoted rate with Uniswap directly',
                'Use "Chi" gas tokens for cheaper transactions (advanced)'
            ]
        }
    },
    {
        id: 'aerodrome',
        name: 'Swap on Aerodrome',
        protocol: 'Aerodrome',
        category: 'swapping',
        ecosystems: ['base'],
        risk: 'safe',
        url: 'https://aerodrome.finance/',
        description: 'The leading DEX on Base network',
        explainer: {
            whatItDoes: 'Trade tokens on Base with very low fees. Also provides liquidity incentives through vote-escrow tokenomics.',
            howItWorks: 'Similar to Uniswap but uses the ve(3,3) model where locked token holders vote on which pools receive emissions. This creates deeper liquidity for popular pairs.',
            fees: '0.05-0.3% swap fee depending on pool type + Base gas (usually < $0.01)',
            tips: [
                'Base has the lowest fees of any major L2',
                'Check if your token has a stable or volatile pool',
                'AERO rewards can boost returns for LPs'
            ]
        }
    },

    // ============ LENDING ============
    {
        id: 'aave-lend',
        name: 'Lend on Aave',
        protocol: 'Aave',
        category: 'lending',
        ecosystems: ['ethereum', 'optimism', 'arbitrum', 'polygon'],
        risk: 'low',
        url: 'https://app.aave.com/',
        description: 'Deposit assets to earn variable interest',
        explainer: {
            whatItDoes: 'Deposit your crypto (ETH, USDC, etc.) and earn interest paid by borrowers. Interest rates adjust in real-time based on supply and demand.',
            howItWorks: 'When you deposit, you receive aTokens (like aUSDC) that automatically accrue interest. Borrowers pay interest to use your deposited assets as loans.',
            fees: 'No deposit fee. Interest rates are variable (check current APY)',
            tips: [
                'Stablecoins often have the highest lending rates',
                'You can withdraw anytime (unless all funds are borrowed)',
                'Watch the utilization rate - high utilization means higher rates'
            ]
        }
    },
    {
        id: 'aave-borrow',
        name: 'Borrow on Aave',
        protocol: 'Aave',
        category: 'lending',
        ecosystems: ['ethereum', 'optimism', 'arbitrum', 'polygon'],
        risk: 'medium',
        url: 'https://app.aave.com/',
        description: 'Borrow assets against your crypto collateral',
        explainer: {
            whatItDoes: 'Deposit collateral and borrow other assets. For example, deposit ETH and borrow USDC without selling your ETH.',
            howItWorks: 'You over-collateralize your loan (e.g., $150 of ETH to borrow $100). If your collateral value drops too low, you risk liquidation.',
            fees: 'Variable interest rate on borrowed amount (check current rate)',
            tips: [
                'Keep your health factor above 1.5 for safety',
                'Watch your liquidation price during market volatility',
                'Stablecoin collateral is safer but earns less'
            ]
        }
    },
    {
        id: 'morpho',
        name: 'Lend on Morpho',
        protocol: 'Morpho',
        category: 'lending',
        ecosystems: ['ethereum', 'base'],
        risk: 'low',
        url: 'https://app.morpho.org/',
        description: 'Peer-to-peer lending for better rates',
        explainer: {
            whatItDoes: 'Get better lending rates by matching lenders and borrowers directly while falling back to Aave/Compound if no match is found.',
            howItWorks: 'Morpho sits on top of Aave and Compound. When possible, it matches you peer-to-peer for better rates. When not, you still get the base protocol rates.',
            fees: 'No protocol fee. Just the underlying protocol rates',
            tips: [
                'Often 0.5-1% better APY than Aave directly',
                'Same security as underlying protocols',
                'Great for larger deposits seeking optimal rates'
            ]
        }
    },

    // ============ STAKING ============
    {
        id: 'lido',
        name: 'Stake ETH with Lido',
        protocol: 'Lido',
        category: 'staking',
        ecosystems: ['ethereum'],
        risk: 'low',
        url: 'https://stake.lido.fi/',
        description: 'Earn ~3-4% APY on your ETH with liquid staking',
        explainer: {
            whatItDoes: 'Stake your ETH to earn validator rewards without running a node. You receive stETH that automatically grows in value as rewards accrue.',
            howItWorks: 'Lido pools ETH from many users and runs validators on their behalf. Your stETH rebases daily to reflect earned rewards.',
            fees: '10% of staking rewards (you keep 90%)',
            tips: [
                'stETH can be used in DeFi while still earning staking rewards',
                'You can swap stETH back to ETH anytime on DEXs',
                'The stETH/ETH peg is usually very close to 1:1'
            ]
        }
    },
    {
        id: 'rocketpool',
        name: 'Stake ETH with Rocket Pool',
        protocol: 'Rocket Pool',
        category: 'staking',
        ecosystems: ['ethereum'],
        risk: 'low',
        url: 'https://stake.rocketpool.net/',
        description: 'Decentralized ETH staking with rETH',
        explainer: {
            whatItDoes: 'Stake ETH and receive rETH, a token that increases in value over time as staking rewards accumulate.',
            howItWorks: 'Rocket Pool is more decentralized than Lido, using individual node operators. rETH appreciates against ETH rather than rebasing.',
            fees: '15% of rewards (you keep 85%)',
            tips: [
                'rETH is more tax-efficient (no daily rebasing)',
                'More decentralized than Lido',
                'Can also run your own mini-pool with 8 ETH'
            ]
        }
    },

    // ============ BRIDGING ============
    {
        id: 'base-bridge',
        name: 'Bridge to Base',
        protocol: 'Base Bridge',
        category: 'bridging',
        ecosystems: ['ethereum', 'base'],
        risk: 'low',
        url: 'https://bridge.base.org/',
        description: 'Official bridge from Ethereum to Base',
        explainer: {
            whatItDoes: 'Move your ETH and other assets from Ethereum mainnet to Base layer 2, where transaction fees are ~100x cheaper.',
            howItWorks: 'You lock assets on Ethereum and receive equivalent assets on Base. Uses Ethereum\'s security with optimistic rollup technology.',
            fees: 'Ethereum gas to bridge (~$5-15) + Base receives for free',
            timeEstimate: '10-20 minutes to Base, 7 days to withdraw back',
            tips: [
                'Only use official bridges for security',
                'Bridge enough ETH for future Base gas fees',
                'Withdrawing back to Ethereum takes 7 days (security feature)'
            ]
        }
    },
    {
        id: 'optimism-bridge',
        name: 'Bridge to Optimism',
        protocol: 'Optimism Bridge',
        category: 'bridging',
        ecosystems: ['ethereum', 'optimism'],
        risk: 'low',
        url: 'https://app.optimism.io/bridge',
        description: 'Official bridge from Ethereum to Optimism',
        explainer: {
            whatItDoes: 'Move assets from Ethereum to Optimism for cheaper DeFi. Optimism has a thriving ecosystem with unique protocols.',
            howItWorks: 'Similar to Base bridge - locks assets on L1, mints on L2. Also uses optimistic rollups.',
            fees: 'Ethereum gas (~$5-15)',
            timeEstimate: '10-20 minutes to OP, 7 days to withdraw',
            tips: [
                'OP tokens can be stacked with other rewards',
                'Velodrome and Synthetix are OP-native protocols',
                'Consider using a fast bridge like Across for quicker exits'
            ]
        }
    },
    {
        id: 'arbitrum-bridge',
        name: 'Bridge to Arbitrum',
        protocol: 'Arbitrum Bridge',
        category: 'bridging',
        ecosystems: ['ethereum', 'arbitrum'],
        risk: 'low',
        url: 'https://bridge.arbitrum.io/',
        description: 'Official bridge from Ethereum to Arbitrum',
        explainer: {
            whatItDoes: 'Bridge to Arbitrum, the largest Ethereum L2 by TVL. Home to GMX, Radiant, and many DeFi protocols.',
            howItWorks: 'Standard L2 bridge using optimistic rollup verification.',
            fees: 'Ethereum gas (~$5-15)',
            timeEstimate: '10-15 minutes to Arbitrum, 7 days to withdraw',
            tips: [
                'Arbitrum has the most DeFi activity of any L2',
                'ARB token rewards are common on Arbitrum protocols',
                'Use Across or Stargate for faster exits if needed'
            ]
        }
    },

    // ============ GOVERNANCE ============
    {
        id: 'snapshot',
        name: 'Vote on Snapshot',
        protocol: 'Snapshot',
        category: 'governance',
        ecosystems: ['ethereum', 'base', 'optimism', 'arbitrum', 'polygon'],
        risk: 'safe',
        url: 'https://snapshot.org/',
        description: 'Participate in DAO governance votes',
        explainer: {
            whatItDoes: 'Vote on protocol decisions using your tokens. Proposals can change fees, add features, allocate treasury funds, and more.',
            howItWorks: 'Snapshot uses off-chain voting (no gas needed) that is cryptographically verified. Your vote weight is based on token holdings.',
            fees: 'Free! No gas required for voting',
            tips: [
                'Delegate your votes if you don\'t want to vote directly',
                'Read proposals carefully before voting',
                'Some protocols reward active governance participation'
            ]
        }
    },
    {
        id: 'tally',
        name: 'Vote on Tally',
        protocol: 'Tally',
        category: 'governance',
        ecosystems: ['ethereum', 'optimism', 'arbitrum', 'polygon'],
        risk: 'safe',
        url: 'https://www.tally.xyz/',
        description: 'On-chain governance for major protocols',
        explainer: {
            whatItDoes: 'Cast on-chain votes for protocols like Uniswap, Compound, and ENS. These votes are binding and execute automatically.',
            howItWorks: 'Unlike Snapshot, these votes happen on-chain and trigger smart contract execution when passed.',
            fees: 'Gas fee to vote (typically $5-20)',
            tips: [
                'Only vote on-chain for important decisions',
                'Delegation is popular to avoid gas costs',
                'Watch proposal timing for quorum requirements'
            ]
        }
    },
];

// Value Flow diagram data
export const VALUE_FLOW_NODES = [
    { id: 'bank', label: 'Bank Account', emoji: '🏦', description: 'Your traditional bank (Chase, Wells Fargo, etc.)' },
    { id: 'cex', label: 'Centralized Exchange', emoji: '📱', description: 'Coinbase, Kraken, Binance - where you buy crypto with fiat' },
    { id: 'wallet', label: 'Your Wallet', emoji: '👛', description: 'MetaMask, Rainbow, Coinbase Wallet - you control the keys' },
    { id: 'l1', label: 'Ethereum Mainnet', emoji: '🔷', description: 'The most secure but expensive network' },
    { id: 'bridge', label: 'Bridge', emoji: '🌉', description: 'Moves assets between different blockchains' },
    { id: 'l2', label: 'Layer 2 Networks', emoji: '⚡', description: 'Base, Optimism, Arbitrum - fast and cheap' },
    { id: 'defi', label: 'DeFi Protocols', emoji: '🏗️', description: 'Lending, staking, swapping - where you put your assets to work' },
];

export const VALUE_FLOW_CONNECTIONS = [
    { from: 'bank', to: 'cex', label: 'Wire/ACH transfer' },
    { from: 'cex', to: 'wallet', label: 'Withdraw crypto' },
    { from: 'wallet', to: 'l1', label: 'Connect & trade' },
    { from: 'l1', to: 'bridge', label: 'Initiate bridge' },
    { from: 'bridge', to: 'l2', label: 'Receive on L2' },
    { from: 'wallet', to: 'l2', label: 'Direct (some L2s)' },
    { from: 'l1', to: 'defi', label: 'Interact with protocols' },
    { from: 'l2', to: 'defi', label: 'Interact with protocols' },
];

// Helper functions
export function getActionsForEcosystem(ecosystem: Ecosystem): DeFiAction[] {
    return DEFI_ACTIONS.filter(a => a.ecosystems.includes(ecosystem));
}

export function getActionsForCategory(category: ActivityCategory): DeFiAction[] {
    return DEFI_ACTIONS.filter(a => a.category === category);
}

export function getActionsFiltered(
    ecosystem: Ecosystem | 'all',
    category: ActivityCategory | 'all',
    risks: RiskLevel[]
): DeFiAction[] {
    return DEFI_ACTIONS.filter(a => {
        const matchEcosystem = ecosystem === 'all' || a.ecosystems.includes(ecosystem);
        const matchCategory = category === 'all' || a.category === category;
        const matchRisk = risks.length === 0 || risks.includes(a.risk);
        return matchEcosystem && matchCategory && matchRisk;
    });
}
