// DeFi Knowledge Terminology Database
// Interactive glossary with linked terms using [[term]] syntax

export interface Term {
    id: string;
    term: string;
    shortDef: string;
    fullDef: string;
    relatedTerms: string[];
    category: 'basics' | 'defi' | 'trading' | 'security' | 'blockchain';
}

// Helper to find a term by its display name (case-insensitive, handles plurals)
export function findTerm(termName: string): Term | undefined {
    const normalized = termName.toLowerCase().trim();

    // First try exact match
    let found = TERMINOLOGY.find(t => t.term.toLowerCase() === normalized);
    if (found) return found;

    // Try removing common plural suffixes (s, es)
    if (normalized.endsWith('s')) {
        const singular = normalized.slice(0, -1);
        found = TERMINOLOGY.find(t => t.term.toLowerCase() === singular);
        if (found) return found;

        // Handle 'es' suffix (e.g., exchanges -> exchange)
        if (normalized.endsWith('es')) {
            const singularEs = normalized.slice(0, -2);
            found = TERMINOLOGY.find(t => t.term.toLowerCase() === singularEs);
            if (found) return found;
        }
    }

    return undefined;
}

// Get all terms in a category
export function getTermsByCategory(category: Term['category']): Term[] {
    return TERMINOLOGY.filter(t => t.category === category);
}

// Get all unique categories
export function getAllCategories(): Term['category'][] {
    return ['basics', 'blockchain', 'defi', 'trading', 'security'];
}

// Category display names and emojis
export const CATEGORY_INFO: Record<Term['category'], { label: string; emoji: string }> = {
    basics: { label: 'Crypto Basics', emoji: '📚' },
    blockchain: { label: 'Blockchain', emoji: '⛓️' },
    defi: { label: 'DeFi', emoji: '🏦' },
    trading: { label: 'Trading', emoji: '📈' },
    security: { label: 'Security', emoji: '🔐' },
};

// Core DeFi terminology database
export const TERMINOLOGY: Term[] = [
    // === BASICS ===
    {
        id: 'cryptocurrency',
        term: 'Cryptocurrency',
        shortDef: 'Digital currency secured by cryptography',
        fullDef: 'A digital or virtual currency that uses [[cryptography]] for security and operates on a [[blockchain]]. Unlike traditional currencies, cryptocurrencies are typically [[decentralized]] and not controlled by any government or central bank. [[Bitcoin]] was the first cryptocurrency.',
        relatedTerms: ['Bitcoin', 'Ethereum', 'Blockchain', 'Wallet'],
        category: 'basics',
    },
    {
        id: 'bitcoin',
        term: 'Bitcoin',
        shortDef: 'The first and largest cryptocurrency',
        fullDef: 'The first [[cryptocurrency]], created in 2009 by the pseudonymous Satoshi Nakamoto. Bitcoin pioneered [[blockchain]] technology and remains the largest crypto by [[market cap]]. It uses [[Proof of Work]] for consensus and has a fixed supply of 21 million coins.',
        relatedTerms: ['Cryptocurrency', 'Blockchain', 'Proof of Work', 'Mining'],
        category: 'basics',
    },
    {
        id: 'ethereum',
        term: 'Ethereum',
        shortDef: 'Programmable blockchain for smart contracts',
        fullDef: 'A [[blockchain]] platform that enables [[smart contracts]] and [[dApps]]. Created by Vitalik Buterin in 2015, Ethereum introduced programmable money and is the foundation for most [[DeFi]] applications. Its native currency is [[ETH]]. It now uses [[Proof of Stake]] for consensus.',
        relatedTerms: ['Smart Contract', 'DeFi', 'dApp', 'ETH', 'Gas'],
        category: 'basics',
    },
    {
        id: 'wallet',
        term: 'Wallet',
        shortDef: 'Software or hardware to store crypto',
        fullDef: 'A tool for storing, sending, and receiving [[cryptocurrency]]. Wallets store your [[private keys]] which prove ownership of your assets. Types include [[hot wallet]]s (software, connected to internet) and [[cold wallet]]s (hardware, offline). Popular options include [[MetaMask]], [[Ledger]], and [[Trust Wallet]].',
        relatedTerms: ['Private Key', 'Seed Phrase', 'Cold Wallet', 'MetaMask'],
        category: 'basics',
    },
    {
        id: 'private-key',
        term: 'Private Key',
        shortDef: 'Secret code that controls your crypto',
        fullDef: 'A cryptographic key that gives you control over your [[cryptocurrency]]. Your private key signs [[transactions]] and proves ownership. Never share your private key with anyone. If you lose it, you lose access to your funds permanently. It\'s typically derived from your [[seed phrase]].',
        relatedTerms: ['Seed Phrase', 'Wallet', 'Public Key'],
        category: 'basics',
    },
    {
        id: 'seed-phrase',
        term: 'Seed Phrase',
        shortDef: '12-24 word backup for your wallet',
        fullDef: 'A series of 12-24 words that can restore your entire [[wallet]]. Also called a recovery phrase or mnemonic. Your seed phrase generates all your [[private keys]]. Write it down on paper and store it securely offline. Never store it digitally or share it with anyone.',
        relatedTerms: ['Private Key', 'Wallet', 'Self-Custody'],
        category: 'basics',
    },
    {
        id: 'eth',
        term: 'ETH',
        shortDef: 'Native currency of Ethereum',
        fullDef: 'The native [[cryptocurrency]] of the [[Ethereum]] network. ETH is used to pay [[gas]] fees for [[transactions]] and [[smart contract]] interactions. It\'s the second-largest crypto by [[market cap]] and is essential for using any [[DeFi]] application on Ethereum.',
        relatedTerms: ['Ethereum', 'Gas', 'Transaction'],
        category: 'basics',
    },
    {
        id: 'token',
        term: 'Token',
        shortDef: 'Crypto asset built on another blockchain',
        fullDef: 'A [[cryptocurrency]] that runs on top of another [[blockchain]] rather than its own. For example, USDC is an [[ERC-20]] token on [[Ethereum]]. Tokens can represent anything: currencies, governance rights, ownership, or access to services. They\'re created using [[smart contracts]].',
        relatedTerms: ['ERC-20', 'Smart Contract', 'Stablecoin'],
        category: 'basics',
    },

    // === BLOCKCHAIN ===
    {
        id: 'blockchain',
        term: 'Blockchain',
        shortDef: 'Distributed ledger of transactions',
        fullDef: 'A [[decentralized]] digital ledger that records [[transactions]] across many computers. Each block contains transaction data and is linked to the previous block, forming a chain. This makes the data tamper-resistant. Examples include [[Bitcoin]], [[Ethereum]], and [[Solana]].',
        relatedTerms: ['Decentralized', 'Transaction', 'Block', 'Node'],
        category: 'blockchain',
    },
    {
        id: 'decentralized',
        term: 'Decentralized',
        shortDef: 'Not controlled by a single entity',
        fullDef: 'A system where control is distributed among many participants rather than held by a central authority. [[Blockchain]] networks are decentralized because thousands of [[nodes]] validate transactions. This provides censorship resistance, transparency, and removes single points of failure.',
        relatedTerms: ['Blockchain', 'Node', 'Centralized Exchange'],
        category: 'blockchain',
    },
    {
        id: 'smart-contract',
        term: 'Smart Contract',
        shortDef: 'Self-executing code on the blockchain',
        fullDef: 'Programs stored on a [[blockchain]] that automatically execute when conditions are met. Smart contracts enable trustless agreements without intermediaries. They power [[DeFi]] protocols, [[NFTs]], and [[dApps]]. Once deployed, they cannot be changed (unless designed to be upgradeable).',
        relatedTerms: ['Ethereum', 'DeFi', 'dApp', 'Solidity'],
        category: 'blockchain',
    },
    {
        id: 'gas',
        term: 'Gas',
        shortDef: 'Fee for blockchain transactions',
        fullDef: 'The unit measuring computational effort on [[Ethereum]] and similar networks. Every [[transaction]] and [[smart contract]] interaction requires gas, paid in [[ETH]]. Gas prices fluctuate based on network demand. High gas fees can make small transactions uneconomical during busy periods.',
        relatedTerms: ['ETH', 'Transaction', 'Gwei'],
        category: 'blockchain',
    },
    {
        id: 'transaction',
        term: 'Transaction',
        shortDef: 'Transfer of value on the blockchain',
        fullDef: 'An action recorded on the [[blockchain]], such as sending [[cryptocurrency]], interacting with a [[smart contract]], or minting an [[NFT]]. Transactions require [[gas]] fees and must be signed with your [[private key]]. Once confirmed, they\'re permanent and irreversible.',
        relatedTerms: ['Gas', 'Block', 'Private Key'],
        category: 'blockchain',
    },
    {
        id: 'proof-of-work',
        term: 'Proof of Work',
        shortDef: 'Mining-based consensus mechanism',
        fullDef: 'A consensus mechanism where [[miners]] compete to solve complex puzzles to validate [[transactions]] and create new blocks. Used by [[Bitcoin]]. It\'s very secure but energy-intensive. The first miner to solve the puzzle earns block rewards.',
        relatedTerms: ['Mining', 'Bitcoin', 'Proof of Stake', 'Consensus'],
        category: 'blockchain',
    },
    {
        id: 'proof-of-stake',
        term: 'Proof of Stake',
        shortDef: 'Staking-based consensus mechanism',
        fullDef: 'A consensus mechanism where validators lock up ([[stake]]) [[cryptocurrency]] as collateral to validate [[transactions]]. Used by [[Ethereum]] since 2022. Much more energy-efficient than [[Proof of Work]]. Validators earn rewards but can be "slashed" for bad behavior.',
        relatedTerms: ['Staking', 'Ethereum', 'Validator', 'Proof of Work'],
        category: 'blockchain',
    },
    {
        id: 'mining',
        term: 'Mining',
        shortDef: 'Computing to validate transactions',
        fullDef: 'The process of using computational power to validate [[transactions]] and add new blocks to a [[blockchain]] using [[Proof of Work]]. Miners compete to solve cryptographic puzzles and earn newly minted [[cryptocurrency]] plus [[transaction]] fees as rewards.',
        relatedTerms: ['Proof of Work', 'Bitcoin', 'Block'],
        category: 'blockchain',
    },
    {
        id: 'node',
        term: 'Node',
        shortDef: 'Computer running blockchain software',
        fullDef: 'A computer that maintains a copy of the [[blockchain]] and helps validate [[transactions]]. Nodes communicate with each other to keep the network [[decentralized]] and synchronized. Anyone can run a node to contribute to network security and verify transactions independently.',
        relatedTerms: ['Blockchain', 'Decentralized', 'Validator'],
        category: 'blockchain',
    },
    {
        id: 'layer-2',
        term: 'Layer 2',
        shortDef: 'Scaling solution built on top of L1',
        fullDef: 'A secondary network built on top of a base [[blockchain]] (Layer 1) to improve speed and reduce [[gas]] costs. Examples include [[Arbitrum]], [[Optimism]], and [[Polygon]] for [[Ethereum]]. Transactions happen on L2 but inherit security from the main chain.',
        relatedTerms: ['Ethereum', 'Gas', 'Rollup', 'Scaling'],
        category: 'blockchain',
    },

    // === DEFI ===
    {
        id: 'defi',
        term: 'DeFi',
        shortDef: 'Decentralized Finance applications',
        fullDef: 'Short for Decentralized Finance. [[Smart contract]]-powered financial services without traditional intermediaries like banks. DeFi includes [[DEXs]], [[lending protocols]], [[yield farming]], and more. Anyone with a [[wallet]] can access DeFi services 24/7, globally.',
        relatedTerms: ['Smart Contract', 'DEX', 'Lending Protocol', 'Yield Farming'],
        category: 'defi',
    },
    {
        id: 'dex',
        term: 'DEX',
        shortDef: 'Decentralized Exchange',
        fullDef: 'A [[decentralized]] exchange that lets you trade [[cryptocurrency]] directly from your [[wallet]] without intermediaries. DEXs use [[smart contracts]] and [[liquidity pools]] instead of order books. Popular DEXs include [[Uniswap]], SushiSwap, and Curve. Compare to [[CEX]].',
        relatedTerms: ['Liquidity Pool', 'AMM', 'Swap', 'CEX'],
        category: 'defi',
    },
    {
        id: 'cex',
        term: 'CEX',
        shortDef: 'Centralized Exchange',
        fullDef: 'A centralized exchange operated by a company, like [[Coinbase]], [[Binance]], or [[Kraken]]. You deposit funds and trade on their platform. CEXs offer convenience and fiat on-ramps but require trust in the company. "Not your keys, not your coins" - consider [[self-custody]] for long-term holding.',
        relatedTerms: ['DEX', 'Wallet', 'Self-Custody', 'KYC'],
        category: 'defi',
    },
    {
        id: 'liquidity-pool',
        term: 'Liquidity Pool',
        shortDef: 'Funds locked in a smart contract for trading',
        fullDef: 'A collection of [[tokens]] locked in a [[smart contract]] that enables trading on a [[DEX]]. Instead of matching buyers and sellers, users trade against the pool. [[Liquidity providers]] earn fees but face [[impermanent loss]] risk. Pools power [[AMM]]s like [[Uniswap]].',
        relatedTerms: ['Liquidity Provider', 'AMM', 'Impermanent Loss', 'DEX'],
        category: 'defi',
    },
    {
        id: 'liquidity-provider',
        term: 'Liquidity Provider',
        shortDef: 'Someone who deposits into liquidity pools',
        fullDef: 'A user who deposits [[tokens]] into a [[liquidity pool]] to enable trading. LPs earn a share of trading fees proportional to their contribution. However, they\'re exposed to [[impermanent loss]] if token prices change significantly. Also called LPing.',
        relatedTerms: ['Liquidity Pool', 'Impermanent Loss', 'LP Token', 'Yield Farming'],
        category: 'defi',
    },
    {
        id: 'amm',
        term: 'AMM',
        shortDef: 'Automated Market Maker',
        fullDef: 'A type of [[DEX]] that uses mathematical formulas instead of order books to price assets. [[Liquidity pools]] provide the trading liquidity, and prices adjust automatically based on supply and demand. The most common formula is x*y=k (constant product). [[Uniswap]] pioneered this model.',
        relatedTerms: ['DEX', 'Liquidity Pool', 'Swap', 'Slippage'],
        category: 'defi',
    },
    {
        id: 'impermanent-loss',
        term: 'Impermanent Loss',
        shortDef: 'Potential loss from providing liquidity',
        fullDef: 'The loss [[liquidity providers]] experience when token prices in a pool diverge from when they deposited. It\'s "impermanent" because the loss only realizes when you withdraw. The greater the price change, the larger the loss. Trading fees may offset this, but it\'s a key risk in [[yield farming]].',
        relatedTerms: ['Liquidity Pool', 'Liquidity Provider', 'AMM'],
        category: 'defi',
    },
    {
        id: 'yield-farming',
        term: 'Yield Farming',
        shortDef: 'Earning rewards by providing liquidity',
        fullDef: 'A strategy to maximize returns by moving crypto between [[DeFi]] protocols to earn the highest [[APY]]. Farmers provide [[liquidity]], stake [[LP tokens]], or lend assets to earn [[tokens]] as rewards. Higher yields often mean higher risks. Also called liquidity mining.',
        relatedTerms: ['Liquidity Pool', 'Staking', 'APY', 'DeFi'],
        category: 'defi',
    },
    {
        id: 'staking',
        term: 'Staking',
        shortDef: 'Locking crypto to earn rewards',
        fullDef: 'Locking up [[cryptocurrency]] to support network operations and earn rewards. On [[Proof of Stake]] networks, staking secures the chain. In [[DeFi]], staking often means depositing tokens in a protocol to earn yield. Staked assets may have a lock-up period or unstaking delay.',
        relatedTerms: ['Proof of Stake', 'Yield Farming', 'APY', 'Validator'],
        category: 'defi',
    },
    {
        id: 'lending-protocol',
        term: 'Lending Protocol',
        shortDef: 'DeFi platform for borrowing and lending',
        fullDef: 'A [[DeFi]] application that lets users lend [[cryptocurrency]] to earn interest or borrow against [[collateral]]. No credit checks needed - loans are secured by over-collateralization. Popular protocols include [[Aave]], [[Compound]], and [[MakerDAO]]. Algorithmic interest rates adjust based on supply/demand.',
        relatedTerms: ['Collateral', 'Liquidation', 'DeFi', 'APY'],
        category: 'defi',
    },
    {
        id: 'collateral',
        term: 'Collateral',
        shortDef: 'Assets pledged to secure a loan',
        fullDef: 'Assets deposited as security when borrowing in [[DeFi]]. Crypto loans are typically over-collateralized (e.g., deposit $150 to borrow $100) because prices are volatile. If your collateral value drops too low, you face [[liquidation]]. Different assets have different collateral ratios.',
        relatedTerms: ['Lending Protocol', 'Liquidation', 'Overcollateralized'],
        category: 'defi',
    },
    {
        id: 'liquidation',
        term: 'Liquidation',
        shortDef: 'Forced sale of collateral',
        fullDef: 'When a loan becomes under-collateralized (the [[collateral]] value drops below the required threshold), the protocol automatically sells the collateral to repay the debt. Liquidators receive a bonus for triggering this. Always monitor your "health factor" when borrowing in [[DeFi]].',
        relatedTerms: ['Collateral', 'Lending Protocol', 'Health Factor'],
        category: 'defi',
    },
    {
        id: 'stablecoin',
        term: 'Stablecoin',
        shortDef: 'Crypto pegged to a stable asset',
        fullDef: 'A [[cryptocurrency]] designed to maintain a stable value, usually pegged to $1 USD. Types include fiat-backed (USDC, USDT), crypto-backed (DAI), and algorithmic. Stablecoins are essential for [[DeFi]] as they provide a stable unit of account without converting to fiat.',
        relatedTerms: ['USDC', 'DAI', 'DeFi', 'Depeg'],
        category: 'defi',
    },
    {
        id: 'tvl',
        term: 'TVL',
        shortDef: 'Total Value Locked in DeFi',
        fullDef: 'Total Value Locked - the total amount of assets deposited in a [[DeFi]] protocol or across all of DeFi. TVL is a key metric for comparing protocol size and adoption. Higher TVL generally indicates more trust and usage, but isn\'t a guarantee of safety.',
        relatedTerms: ['DeFi', 'Liquidity Pool', 'Protocol'],
        category: 'defi',
    },
    {
        id: 'apy',
        term: 'APY',
        shortDef: 'Annual Percentage Yield',
        fullDef: 'The annualized return you\'d earn including compound interest. In [[DeFi]], APYs can range from 1% to thousands of percent (high APY usually means high risk or unsustainable rewards). Compare to APR which doesn\'t include compounding. Always verify if APY is sustainable.',
        relatedTerms: ['Yield Farming', 'Staking', 'APR'],
        category: 'defi',
    },
    {
        id: 'swap',
        term: 'Swap',
        shortDef: 'Trading one token for another',
        fullDef: 'Exchanging one [[token]] for another on a [[DEX]]. Swaps use [[liquidity pools]] to execute trades instantly. You\'ll pay a small fee (typically 0.3%) plus [[gas]]. Watch out for [[slippage]] on large trades or low-liquidity pairs.',
        relatedTerms: ['DEX', 'Liquidity Pool', 'Slippage', 'Gas'],
        category: 'defi',
    },
    {
        id: 'bridge',
        term: 'Bridge',
        shortDef: 'Transfer assets between blockchains',
        fullDef: 'A protocol that enables moving [[tokens]] between different [[blockchains]] (e.g., from [[Ethereum]] to [[Polygon]]). Bridges lock assets on one chain and mint equivalent tokens on another. They\'re essential for cross-chain [[DeFi]] but are frequent targets for hacks.',
        relatedTerms: ['Layer 2', 'Cross-Chain', 'Wrapped Token'],
        category: 'defi',
    },

    // === TRADING ===
    {
        id: 'slippage',
        term: 'Slippage',
        shortDef: 'Price difference between expected and executed',
        fullDef: 'The difference between the expected price of a trade and the actual executed price. Slippage occurs due to price movement or low [[liquidity]]. Set slippage tolerance in your [[DEX]] settings - too low may cause failed transactions, too high may result in bad prices.',
        relatedTerms: ['DEX', 'Liquidity Pool', 'Swap', 'Front-Running'],
        category: 'trading',
    },
    {
        id: 'market-cap',
        term: 'Market Cap',
        shortDef: 'Total value of a cryptocurrency',
        fullDef: 'Market capitalization - the total value of all coins in circulation, calculated as price × circulating supply. [[Bitcoin]] has the largest market cap. Market cap helps compare relative sizes of cryptocurrencies but doesn\'t indicate future performance.',
        relatedTerms: ['Circulating Supply', 'Fully Diluted Valuation'],
        category: 'trading',
    },
    {
        id: 'dyor',
        term: 'DYOR',
        shortDef: 'Do Your Own Research',
        fullDef: 'A common crypto saying reminding people to research before investing. Don\'t blindly follow influencers or hype. Check the team, tokenomics, code audits, community, and use case. Many projects are [[scams]] or poorly designed. DYOR protects you from rug pulls.',
        relatedTerms: ['Rug Pull', 'Scam', 'Audit'],
        category: 'trading',
    },
    {
        id: 'whale',
        term: 'Whale',
        shortDef: 'Someone holding large amounts of crypto',
        fullDef: 'An individual or entity holding a very large amount of [[cryptocurrency]]. Whale movements can significantly impact prices due to the size of their trades. Whale tracking tools monitor large wallet transactions. Be aware that whales can manipulate markets.',
        relatedTerms: ['Market Cap', 'Liquidity'],
        category: 'trading',
    },
    {
        id: 'fomo',
        term: 'FOMO',
        shortDef: 'Fear Of Missing Out',
        fullDef: 'The anxiety that you\'re missing a profitable opportunity. FOMO often leads to buying at market tops or entering projects without proper research. It\'s a powerful emotion that causes poor decisions. Combat FOMO with a clear investment strategy and [[DYOR]].',
        relatedTerms: ['DYOR', 'FUD'],
        category: 'trading',
    },
    {
        id: 'fud',
        term: 'FUD',
        shortDef: 'Fear, Uncertainty, and Doubt',
        fullDef: 'Negative information, true or false, spread to cause panic selling. FUD can be legitimate concerns or deliberate manipulation. Evaluate critically: is the concern valid? Who benefits from spreading it? Don\'t make emotional decisions based on FUD.',
        relatedTerms: ['FOMO', 'DYOR'],
        category: 'trading',
    },
    {
        id: 'hodl',
        term: 'HODL',
        shortDef: 'Hold On for Dear Life',
        fullDef: 'Originally a typo for "hold," now means holding [[cryptocurrency]] long-term regardless of price volatility. HODLers believe in long-term appreciation and don\'t sell during dips. It\'s a strategy that avoids emotional trading but requires conviction in your investments.',
        relatedTerms: ['FOMO', 'FUD', 'Diamond Hands'],
        category: 'trading',
    },

    // === SECURITY ===
    {
        id: 'rug-pull',
        term: 'Rug Pull',
        shortDef: 'Scam where developers abandon project',
        fullDef: 'A [[scam]] where developers create a project, attract investment, then drain the [[liquidity pool]] or otherwise steal funds and disappear. Common in new [[DeFi]] projects and meme coins. Red flags: anonymous team, unaudited contracts, locked liquidity claims. Always [[DYOR]].',
        relatedTerms: ['Scam', 'DYOR', 'Audit', 'Liquidity Pool'],
        category: 'security',
    },
    {
        id: 'scam',
        term: 'Scam',
        shortDef: 'Fraudulent scheme to steal crypto',
        fullDef: 'Any fraudulent scheme designed to steal your [[cryptocurrency]] or [[private keys]]. Common types include [[rug pulls]], phishing, fake airdrops, and impersonation. Never share your [[seed phrase]], verify URLs carefully, and be skeptical of unrealistic promises.',
        relatedTerms: ['Rug Pull', 'Phishing', 'Seed Phrase', 'DYOR'],
        category: 'security',
    },
    {
        id: 'audit',
        term: 'Audit',
        shortDef: 'Security review of smart contracts',
        fullDef: 'A professional security review of a protocol\'s [[smart contracts]] to find vulnerabilities. Audits are conducted by firms like Certik, Trail of Bits, or OpenZeppelin. While audits reduce risk, they don\'t guarantee safety - bugs can still exist. Check if a protocol is audited before investing.',
        relatedTerms: ['Smart Contract', 'DeFi', 'Security'],
        category: 'security',
    },
    {
        id: 'self-custody',
        term: 'Self-Custody',
        shortDef: 'Controlling your own private keys',
        fullDef: 'Holding your [[cryptocurrency]] in a [[wallet]] where you control the [[private keys]], as opposed to leaving funds on a [[CEX]]. "Not your keys, not your coins" - exchanges can freeze accounts, get hacked, or go bankrupt. Self-custody gives you full control but full responsibility.',
        relatedTerms: ['Wallet', 'Private Key', 'Seed Phrase', 'Cold Wallet'],
        category: 'security',
    },
    {
        id: 'cold-wallet',
        term: 'Cold Wallet',
        shortDef: 'Offline device for storing crypto',
        fullDef: 'A hardware device that stores your [[private keys]] offline, disconnected from the internet. Cold wallets like [[Ledger]] and [[Trezor]] provide maximum security against hacks. Use cold storage for long-term holdings and large amounts. Keep a backup of your [[seed phrase]].',
        relatedTerms: ['Wallet', 'Private Key', 'Self-Custody', 'Seed Phrase'],
        category: 'security',
    },
    {
        id: 'phishing',
        term: 'Phishing',
        shortDef: 'Fake websites/messages to steal keys',
        fullDef: 'Attacks using fake websites, emails, or messages that impersonate legitimate services to steal your [[private keys]] or [[seed phrase]]. Always verify URLs, bookmark trusted sites, and never enter your seed phrase on a website. Real support will never ask for your keys.',
        relatedTerms: ['Scam', 'Seed Phrase', 'Private Key'],
        category: 'security',
    },
    {
        id: 'dapp',
        term: 'dApp',
        shortDef: 'Decentralized Application',
        fullDef: 'An application built on [[blockchain]] using [[smart contracts]]. Unlike traditional apps, dApps are [[decentralized]] - they run on a network of computers, not a single server. You interact with dApps using your [[wallet]]. Examples include [[DEXs]], games, and social platforms.',
        relatedTerms: ['Smart Contract', 'Blockchain', 'Wallet', 'DeFi'],
        category: 'blockchain',
    },
    {
        id: 'nft',
        term: 'NFT',
        shortDef: 'Non-Fungible Token - unique digital asset',
        fullDef: 'Non-Fungible Token - a unique [[token]] on a [[blockchain]] representing ownership of a specific item like art, music, or collectibles. Unlike [[cryptocurrency]], each NFT is unique and not interchangeable. NFTs are stored in your [[wallet]] and can be bought/sold on marketplaces.',
        relatedTerms: ['Token', 'Blockchain', 'Smart Contract', 'Wallet'],
        category: 'blockchain',
    },
    {
        id: 'dao',
        term: 'DAO',
        shortDef: 'Decentralized Autonomous Organization',
        fullDef: 'A [[decentralized]] organization governed by [[smart contracts]] and token holder votes rather than traditional management. DAO members vote on proposals using [[governance]] [[tokens]]. DAOs control [[DeFi]] protocols, investment funds, and communities. Examples: [[MakerDAO]], [[Uniswap]] governance.',
        relatedTerms: ['Governance', 'Smart Contract', 'Decentralized', 'Token'],
        category: 'defi',
    },
    {
        id: 'governance',
        term: 'Governance',
        shortDef: 'Voting on protocol decisions',
        fullDef: 'The process by which token holders vote on changes to a [[DeFi]] protocol. Governance tokens give voting power on proposals like fee changes, new features, or treasury spending. Active participation in governance helps shape the future of protocols you use.',
        relatedTerms: ['DAO', 'Token', 'DeFi'],
        category: 'defi',
    },
    {
        id: 'airdrop',
        term: 'Airdrop',
        shortDef: 'Free tokens distributed to users',
        fullDef: 'Free [[tokens]] distributed to [[wallet]] addresses, often to reward early users or promote a new project. Eligibility may depend on past activity, holding specific tokens, or completing tasks. Be careful of fake airdrop [[scams]] - never approve suspicious [[transactions]].',
        relatedTerms: ['Token', 'Wallet', 'Scam'],
        category: 'defi',
    },

    // === WALLETS ===
    {
        id: 'metamask',
        term: 'MetaMask',
        shortDef: 'Popular browser extension wallet',
        fullDef: 'The most popular [[hot wallet]] for [[Ethereum]] and [[EVM]]-compatible chains. MetaMask is a browser extension and mobile app that lets you store [[cryptocurrency]], interact with [[dApps]], and sign [[transactions]]. It\'s free and essential for using [[DeFi]]. Always verify you\'re on the official site to avoid [[phishing]].',
        relatedTerms: ['Hot Wallet', 'Ethereum', 'dApp', 'Private Key'],
        category: 'basics',
    },
    {
        id: 'ledger',
        term: 'Ledger',
        shortDef: 'Leading hardware wallet brand',
        fullDef: 'A popular [[cold wallet]] brand that stores your [[private keys]] on a secure hardware device. Ledger devices (Nano S, Nano X) keep your keys offline, protecting against hacks. Use Ledger for long-term storage of significant amounts. Always buy directly from Ledger to avoid tampered devices.',
        relatedTerms: ['Cold Wallet', 'Private Key', 'Self-Custody', 'Trezor'],
        category: 'security',
    },
    {
        id: 'trezor',
        term: 'Trezor',
        shortDef: 'Pioneer hardware wallet brand',
        fullDef: 'One of the first [[cold wallet]] brands, created in 2014. Trezor devices store your [[private keys]] offline for maximum security. Open-source firmware allows community verification. Like [[Ledger]], Trezor is ideal for [[self-custody]] of larger crypto holdings.',
        relatedTerms: ['Cold Wallet', 'Private Key', 'Ledger', 'Self-Custody'],
        category: 'security',
    },
    {
        id: 'trust-wallet',
        term: 'Trust Wallet',
        shortDef: 'Multi-chain mobile wallet',
        fullDef: 'A popular mobile [[hot wallet]] supporting multiple [[blockchains]] including [[Ethereum]], BNB Chain, Solana, and more. Owned by [[Binance]]. Trust Wallet lets you store [[tokens]], access [[dApps]], and stake crypto. Remember: it\'s still a hot wallet, so use [[cold wallets]] for large amounts.',
        relatedTerms: ['Hot Wallet', 'Binance', 'dApp', 'Staking'],
        category: 'basics',
    },
    {
        id: 'hot-wallet',
        term: 'Hot Wallet',
        shortDef: 'Internet-connected software wallet',
        fullDef: 'A [[wallet]] that\'s connected to the internet, either as a browser extension, mobile app, or desktop software. Examples include [[MetaMask]], [[Trust Wallet]], and exchange wallets. Hot wallets are convenient for daily use but more vulnerable to hacks. Keep only small amounts in hot wallets.',
        relatedTerms: ['MetaMask', 'Trust Wallet', 'Cold Wallet', 'Private Key'],
        category: 'basics',
    },
    {
        id: 'hardware-wallet',
        term: 'Hardware Wallet',
        shortDef: 'Physical device for secure storage',
        fullDef: 'A physical device that stores your [[private keys]] offline, also called a [[cold wallet]]. Popular brands include [[Ledger]] and [[Trezor]]. Hardware wallets sign [[transactions]] without exposing your keys to the internet. Essential for [[self-custody]] of significant crypto holdings.',
        relatedTerms: ['Cold Wallet', 'Ledger', 'Trezor', 'Self-Custody'],
        category: 'security',
    },
    {
        id: 'public-key',
        term: 'Public Key',
        shortDef: 'Your wallet address derived from private key',
        fullDef: 'A cryptographic key derived from your [[private key]] that serves as your [[wallet]] address. You can share your public key to receive [[cryptocurrency]]. Think of it like an email address - safe to share, but only the [[private key]] holder can access the funds.',
        relatedTerms: ['Private Key', 'Wallet', 'Transaction'],
        category: 'basics',
    },

    // === EXCHANGES & PLATFORMS ===
    {
        id: 'coinbase',
        term: 'Coinbase',
        shortDef: 'Major US cryptocurrency exchange',
        fullDef: 'One of the largest [[CEX]] platforms, especially popular in the United States. Coinbase offers easy fiat on-ramps, a user-friendly interface, and is publicly traded. Good for beginners but has higher fees than some competitors. Remember: funds on any [[CEX]] are not in your [[self-custody]].',
        relatedTerms: ['CEX', 'Self-Custody', 'Binance', 'Kraken'],
        category: 'defi',
    },
    {
        id: 'binance',
        term: 'Binance',
        shortDef: 'World\'s largest crypto exchange',
        fullDef: 'The largest [[CEX]] by trading volume globally. Binance offers extensive trading pairs, low fees, and its own [[blockchain]] (BNB Chain). Created [[Trust Wallet]]. Note: regulatory status varies by country. Always consider [[self-custody]] for long-term holdings.',
        relatedTerms: ['CEX', 'Trust Wallet', 'Coinbase', 'BNB'],
        category: 'defi',
    },
    {
        id: 'kraken',
        term: 'Kraken',
        shortDef: 'Established crypto exchange',
        fullDef: 'A major [[CEX]] known for security and regulatory compliance. Founded in 2011, Kraken offers trading, [[staking]], and futures. Popular among more experienced traders. Like all centralized exchanges, consider moving assets to [[self-custody]] for long-term storage.',
        relatedTerms: ['CEX', 'Staking', 'Coinbase', 'Self-Custody'],
        category: 'defi',
    },
    {
        id: 'uniswap',
        term: 'Uniswap',
        shortDef: 'Largest decentralized exchange',
        fullDef: 'The pioneering and largest [[DEX]] on [[Ethereum]], introducing the [[AMM]] model. Uniswap uses [[liquidity pools]] instead of order books. Anyone can [[swap]] tokens or provide [[liquidity]]. The UNI [[token]] provides [[governance]] rights. Revolutionized [[DeFi]] trading.',
        relatedTerms: ['DEX', 'AMM', 'Liquidity Pool', 'Swap', 'Ethereum'],
        category: 'defi',
    },
    {
        id: 'aave',
        term: 'Aave',
        shortDef: 'Leading DeFi lending protocol',
        fullDef: 'One of the largest [[lending protocols]] in [[DeFi]]. Aave lets you lend [[cryptocurrency]] to earn interest or borrow against your [[collateral]]. Features flash loans and variable/stable interest rates. Available on [[Ethereum]] and multiple [[Layer 2]] networks.',
        relatedTerms: ['Lending Protocol', 'DeFi', 'Collateral', 'Flash Loan'],
        category: 'defi',
    },
    {
        id: 'compound',
        term: 'Compound',
        shortDef: 'Algorithmic lending protocol',
        fullDef: 'A pioneering [[lending protocol]] on [[Ethereum]]. Compound introduced algorithmic interest rates that adjust based on supply and demand. Lend assets to earn COMP [[tokens]], or borrow against [[collateral]]. Governed by COMP token holders through [[DAO]] voting.',
        relatedTerms: ['Lending Protocol', 'DeFi', 'DAO', 'Collateral'],
        category: 'defi',
    },
    {
        id: 'opensea',
        term: 'OpenSea',
        shortDef: 'Largest NFT marketplace',
        fullDef: 'The largest marketplace for buying, selling, and discovering [[NFTs]]. Connect your [[wallet]] like [[MetaMask]] to browse and trade digital art, collectibles, and more. Supports [[Ethereum]] and Polygon. Be cautious of fake collections and always verify before buying.',
        relatedTerms: ['NFT', 'Wallet', 'MetaMask', 'Ethereum'],
        category: 'blockchain',
    },

    // === BLOCKCHAIN CONCEPTS ===
    {
        id: 'evm',
        term: 'EVM',
        shortDef: 'Ethereum Virtual Machine',
        fullDef: 'The runtime environment for [[smart contracts]] on [[Ethereum]]. EVM-compatible chains (Polygon, Arbitrum, BNB Chain) can run the same [[smart contracts]] as Ethereum. This compatibility means [[wallets]] like [[MetaMask]] work across many chains.',
        relatedTerms: ['Ethereum', 'Smart Contract', 'Layer 2', 'MetaMask'],
        category: 'blockchain',
    },
    {
        id: 'erc-20',
        term: 'ERC-20',
        shortDef: 'Token standard on Ethereum',
        fullDef: 'The most common [[token]] standard on [[Ethereum]]. ERC-20 defines functions that tokens must implement, ensuring compatibility with [[wallets]], [[DEXs]], and [[dApps]]. Examples include USDC, LINK, and UNI. Other standards include ERC-721 for [[NFTs]].',
        relatedTerms: ['Token', 'Ethereum', 'Smart Contract', 'NFT'],
        category: 'blockchain',
    },
    {
        id: 'solana',
        term: 'Solana',
        shortDef: 'High-speed blockchain platform',
        fullDef: 'A high-performance [[blockchain]] known for fast [[transactions]] and low fees. Solana can process thousands of transactions per second. It has its own ecosystem of [[dApps]], [[NFTs]], and [[DeFi]]. Uses a unique Proof of History consensus alongside [[Proof of Stake]].',
        relatedTerms: ['Blockchain', 'DeFi', 'NFT', 'Proof of Stake'],
        category: 'blockchain',
    },
    {
        id: 'polygon',
        term: 'Polygon',
        shortDef: 'Ethereum scaling solution',
        fullDef: 'A [[Layer 2]] scaling solution for [[Ethereum]] offering faster and cheaper [[transactions]]. Polygon is [[EVM]]-compatible, so [[dApps]] work seamlessly. Popular for [[NFTs]] and [[DeFi]] due to low [[gas]] costs. MATIC is its native [[token]].',
        relatedTerms: ['Layer 2', 'Ethereum', 'EVM', 'Gas'],
        category: 'blockchain',
    },
    {
        id: 'arbitrum',
        term: 'Arbitrum',
        shortDef: 'Ethereum Layer 2 rollup',
        fullDef: 'A leading [[Layer 2]] scaling solution for [[Ethereum]] using optimistic rollup technology. Arbitrum offers much lower [[gas]] fees while inheriting [[Ethereum]]\'s security. Popular for [[DeFi]] applications. [[EVM]]-compatible, so existing [[dApps]] work with minimal changes.',
        relatedTerms: ['Layer 2', 'Ethereum', 'Gas', 'Rollup'],
        category: 'blockchain',
    },
    {
        id: 'optimism',
        term: 'Optimism',
        shortDef: 'Ethereum Layer 2 network',
        fullDef: 'An optimistic rollup [[Layer 2]] for [[Ethereum]], similar to [[Arbitrum]]. Offers faster and cheaper [[transactions]] while maintaining [[Ethereum]] security. The OP [[token]] provides [[governance]] rights. Popular among [[DeFi]] protocols seeking lower fees.',
        relatedTerms: ['Layer 2', 'Ethereum', 'Arbitrum', 'Rollup'],
        category: 'blockchain',
    },
    {
        id: 'bnb',
        term: 'BNB',
        shortDef: 'Binance native token',
        fullDef: 'The native [[cryptocurrency]] of BNB Chain (formerly Binance Smart Chain) and the [[Binance]] exchange. Used for [[gas]] fees on BNB Chain, trading fee discounts on Binance, and various [[DeFi]] applications. One of the largest cryptos by [[market cap]].',
        relatedTerms: ['Binance', 'Gas', 'Cryptocurrency', 'DeFi'],
        category: 'basics',
    },
    {
        id: 'validator',
        term: 'Validator',
        shortDef: 'Node that validates transactions',
        fullDef: 'In [[Proof of Stake]] networks, validators [[stake]] [[cryptocurrency]] as collateral to validate [[transactions]] and propose new blocks. They earn rewards for honest behavior but can be "slashed" (lose stake) for malicious actions. You can delegate stake to validators without running one yourself.',
        relatedTerms: ['Proof of Stake', 'Staking', 'Node', 'Slashing'],
        category: 'blockchain',
    },
    {
        id: 'block',
        term: 'Block',
        shortDef: 'Bundle of transactions on blockchain',
        fullDef: 'A collection of [[transactions]] grouped together and added to the [[blockchain]]. Each block contains a reference to the previous block, forming the chain. Blocks are added by [[miners]] ([[Proof of Work]]) or [[validators]] ([[Proof of Stake]]). Block time varies by chain.',
        relatedTerms: ['Blockchain', 'Transaction', 'Mining', 'Validator'],
        category: 'blockchain',
    },
    {
        id: 'gwei',
        term: 'Gwei',
        shortDef: 'Unit for measuring gas prices',
        fullDef: 'A denomination of [[ETH]] used to measure [[gas]] prices on [[Ethereum]]. 1 Gwei = 0.000000001 ETH. When gas is "30 gwei," you\'re paying 30 gwei per unit of gas. Higher gwei means faster [[transaction]] confirmation but higher fees.',
        relatedTerms: ['Gas', 'ETH', 'Ethereum', 'Transaction'],
        category: 'blockchain',
    },
    {
        id: 'rollup',
        term: 'Rollup',
        shortDef: 'Layer 2 scaling technology',
        fullDef: 'A [[Layer 2]] scaling solution that bundles (rolls up) many [[transactions]] into one, then posts the result to [[Ethereum]]. Types include optimistic rollups ([[Arbitrum]], [[Optimism]]) and zk-rollups. Rollups inherit mainnet security while dramatically reducing [[gas]] costs.',
        relatedTerms: ['Layer 2', 'Ethereum', 'Arbitrum', 'Optimism'],
        category: 'blockchain',
    },
    {
        id: 'cryptography',
        term: 'Cryptography',
        shortDef: 'Math-based security techniques',
        fullDef: 'The mathematical techniques that secure [[cryptocurrency]] and [[blockchain]] networks. Cryptography enables [[private keys]], digital signatures, and secure [[transactions]]. It\'s what makes blockchain tamper-resistant and allows trustless verification.',
        relatedTerms: ['Private Key', 'Blockchain', 'Transaction'],
        category: 'blockchain',
    },

    // === DEFI ADVANCED ===
    {
        id: 'flash-loan',
        term: 'Flash Loan',
        shortDef: 'Uncollateralized instant loan',
        fullDef: 'A [[DeFi]] innovation allowing you to borrow [[cryptocurrency]] without [[collateral]], as long as you repay it in the same [[transaction]]. If not repaid, the entire transaction reverts. Used for arbitrage, [[liquidations]], and collateral swaps. Pioneered by [[Aave]].',
        relatedTerms: ['Aave', 'DeFi', 'Collateral', 'Arbitrage'],
        category: 'defi',
    },
    {
        id: 'lp-token',
        term: 'LP Token',
        shortDef: 'Receipt for liquidity provided',
        fullDef: 'A [[token]] you receive when depositing into a [[liquidity pool]], representing your share of the pool. LP tokens can often be [[staked]] in farms to earn additional rewards ([[yield farming]]). Redeem LP tokens to withdraw your share plus earned fees.',
        relatedTerms: ['Liquidity Pool', 'Liquidity Provider', 'Yield Farming', 'Staking'],
        category: 'defi',
    },
    {
        id: 'wrapped-token',
        term: 'Wrapped Token',
        shortDef: 'Token representing another asset',
        fullDef: 'A [[token]] that represents another [[cryptocurrency]] on a different [[blockchain]]. For example, WBTC (Wrapped [[Bitcoin]]) is [[Bitcoin]] on [[Ethereum]]. Wrapping enables using assets in [[DeFi]] ecosystems where they\'re not native. The underlying asset is held in custody.',
        relatedTerms: ['Token', 'Bitcoin', 'Ethereum', 'DeFi'],
        category: 'defi',
    },
    {
        id: 'usdc',
        term: 'USDC',
        shortDef: 'USD-backed stablecoin',
        fullDef: 'A popular [[stablecoin]] pegged to $1 USD, issued by Circle. USDC is backed 1:1 by cash and short-term treasuries, with regular audits. Widely used in [[DeFi]] for stable value, lending, and trading pairs. Available on [[Ethereum]], [[Solana]], and many other [[blockchains]].',
        relatedTerms: ['Stablecoin', 'DeFi', 'USDT', 'DAI'],
        category: 'defi',
    },
    {
        id: 'usdt',
        term: 'USDT',
        shortDef: 'Tether stablecoin',
        fullDef: 'The largest [[stablecoin]] by [[market cap]], issued by Tether. USDT is pegged to $1 USD and widely used for trading and [[DeFi]]. Has faced controversy over reserve transparency. Available on nearly every [[blockchain]] and [[exchange]].',
        relatedTerms: ['Stablecoin', 'USDC', 'DeFi', 'CEX'],
        category: 'defi',
    },
    {
        id: 'dai',
        term: 'DAI',
        shortDef: 'Decentralized stablecoin',
        fullDef: 'A [[decentralized]] [[stablecoin]] created by [[MakerDAO]], pegged to $1 USD. Unlike [[USDC]] or [[USDT]], DAI is backed by crypto [[collateral]] (overcollateralized) rather than fiat. Generated by locking collateral in Maker vaults. A cornerstone of [[DeFi]].',
        relatedTerms: ['Stablecoin', 'Decentralized', 'Collateral', 'MakerDAO'],
        category: 'defi',
    },
    {
        id: 'makerdao',
        term: 'MakerDAO',
        shortDef: 'Creator of DAI stablecoin',
        fullDef: 'The [[DAO]] behind [[DAI]], one of [[DeFi]]\'s foundational protocols. Users deposit [[collateral]] to mint DAI. The MKR [[token]] provides [[governance]] rights. MakerDAO pioneered crypto-collateralized [[stablecoins]] and on-chain governance.',
        relatedTerms: ['DAO', 'DAI', 'Collateral', 'Governance'],
        category: 'defi',
    },
    {
        id: 'apr',
        term: 'APR',
        shortDef: 'Annual Percentage Rate',
        fullDef: 'The yearly interest rate without compounding. In [[DeFi]], APR shows the base rate before compound interest. Compare to [[APY]] which includes compounding. APR is often lower than APY for the same opportunity. Always check which metric a protocol displays.',
        relatedTerms: ['APY', 'Yield Farming', 'Staking'],
        category: 'defi',
    },
    {
        id: 'kyc',
        term: 'KYC',
        shortDef: 'Know Your Customer verification',
        fullDef: 'Identity verification required by [[CEX]] platforms like [[Coinbase]] and [[Binance]] to comply with regulations. KYC typically requires ID documents and personal information. [[DEXs]] and [[DeFi]] protocols generally don\'t require KYC, preserving privacy.',
        relatedTerms: ['CEX', 'Coinbase', 'Binance', 'DEX'],
        category: 'trading',
    },
    {
        id: 'slashing',
        term: 'Slashing',
        shortDef: 'Penalty for validator misbehavior',
        fullDef: 'In [[Proof of Stake]], [[validators]] can lose a portion of their [[staked]] [[cryptocurrency]] for misbehavior like double-signing or extended downtime. Slashing incentivizes honest validation. When delegating stake, consider validator reliability.',
        relatedTerms: ['Proof of Stake', 'Validator', 'Staking'],
        category: 'blockchain',
    },
    {
        id: 'front-running',
        term: 'Front-Running',
        shortDef: 'Transaction placed ahead of yours',
        fullDef: 'When someone sees your pending [[transaction]] and places their own with higher [[gas]] to execute first, profiting at your expense. Common with [[DEX]] trades. MEV bots automate this. Protect yourself with private mempools or [[slippage]] limits.',
        relatedTerms: ['Transaction', 'Gas', 'DEX', 'Slippage', 'MEV'],
        category: 'trading',
    },
    {
        id: 'mev',
        term: 'MEV',
        shortDef: 'Maximal Extractable Value',
        fullDef: 'The profit [[validators]] or miners can extract by reordering, including, or excluding [[transactions]] in a [[block]]. MEV includes [[front-running]], sandwiching trades, and [[arbitrage]]. It\'s a complex topic affecting [[DeFi]] users and network fairness.',
        relatedTerms: ['Front-Running', 'Validator', 'Block', 'Arbitrage'],
        category: 'trading',
    },
    {
        id: 'arbitrage',
        term: 'Arbitrage',
        shortDef: 'Profiting from price differences',
        fullDef: 'Buying an asset on one [[exchange]] or [[DEX]] where it\'s cheaper and selling on another where it\'s more expensive. Arbitrage helps keep prices consistent across markets. In [[DeFi]], bots and [[flash loans]] enable instant arbitrage opportunities.',
        relatedTerms: ['DEX', 'Flash Loan', 'MEV', 'Trading'],
        category: 'trading',
    },
    {
        id: 'depeg',
        term: 'Depeg',
        shortDef: 'Stablecoin losing its peg',
        fullDef: 'When a [[stablecoin]] loses its intended value (usually $1 USD). Depegs can be temporary (market volatility) or permanent (protocol failure). The UST collapse in 2022 was a catastrophic depeg. Always research [[stablecoin]] backing and risks.',
        relatedTerms: ['Stablecoin', 'USDC', 'DAI', 'Risk'],
        category: 'defi',
    },
    {
        id: 'solidity',
        term: 'Solidity',
        shortDef: 'Programming language for Ethereum',
        fullDef: 'The primary programming language for writing [[smart contracts]] on [[Ethereum]] and [[EVM]]-compatible chains. Solidity code is compiled and deployed to the [[blockchain]]. Learning Solidity is essential for [[DeFi]] developers.',
        relatedTerms: ['Smart Contract', 'Ethereum', 'EVM', 'dApp'],
        category: 'blockchain',
    },
];

