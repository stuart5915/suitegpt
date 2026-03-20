// Factory Signal Board — "What should I build?"
// Loads all existing apps, categorizes them, finds gaps, scores suggestions

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

const COUNCIL = new Set([
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
    '0x18b18e245122f4bda5f2ee4f25c702e05c241d49',
    '0x496f68438493eb1cc632f7cec6634f042c95e333',
    '0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3',
    '0xc2599f1009669f4cda7ac2493de06d450fc79ef9'
]);

// ────────────────────────────────────────────────────────────
// CATEGORIES — 20 verticals with scoring weights (1-10)
// revenue: how much $ can this type of app generate
// agent: how well can AI agents use this app 24/7
// viral: how shareable / growth-friendly is this type
// ────────────────────────────────────────────────────────────
const CATEGORIES = {
    'defi-tools': { name: 'DeFi Tools', revenue: 9, agent: 9, viral: 5, keywords: ['defi', 'yield', 'swap', 'liquidity', 'portfolio', 'wallet', 'bridge', 'lending', 'borrow', 'vault', 'farm', 'apy', 'compound', 'lp ', 'staking dashboard', 'token dashboard'] },
    'trading': { name: 'Trading & Markets', revenue: 10, agent: 10, viral: 6, keywords: ['trade', 'trading', 'prediction', 'futures', 'options', 'exchange', 'price alert', 'chart', 'signal', 'copy-trade', 'perpetual', 'order book', 'betting', 'wager'] },
    'gaming-arcade': { name: 'Gaming — Arcade', revenue: 6, agent: 8, viral: 9, keywords: ['arcade', 'reaction', 'typing', 'clicker', 'runner', 'dodge', 'reflex', 'speed', 'quick'] },
    'gaming-strategy': { name: 'Gaming — Strategy', revenue: 7, agent: 9, viral: 7, keywords: ['strategy', 'tower defense', 'chess', 'tactics', 'civilization', 'empire', 'conquest', 'war', 'army'] },
    'gaming-multiplayer': { name: 'Gaming — Multiplayer', revenue: 8, agent: 10, viral: 9, keywords: ['multiplayer', 'pvp', 'battle', 'arena', 'fight', 'duel', 'poker', 'versus', 'compete', 'tournament', 'league'] },
    'gaming-casino': { name: 'Gaming — Casino/Chance', revenue: 10, agent: 8, viral: 7, keywords: ['casino', 'dice', 'slot', 'roulette', 'lottery', 'raffle', 'jackpot', 'crash', 'coinflip', 'spin'] },
    'social': { name: 'Social & Community', revenue: 4, agent: 6, viral: 10, keywords: ['social', 'chat', 'message', 'community', 'forum', 'feed', 'campfire', 'confess', 'anonymous', 'friend', 'group'] },
    'creator-tools': { name: 'Creator Tools', revenue: 6, agent: 7, viral: 7, keywords: ['create', 'creator', 'draw', 'whiteboard', 'design', 'art', 'music', 'jukebox', 'studio', 'editor', 'canvas', 'compose', 'remix', 'generate'] },
    'nft': { name: 'NFT & Collectibles', revenue: 7, agent: 7, viral: 8, keywords: ['nft', 'mint', 'collectible', 'pfp', 'avatar', 'gallery', 'collection', 'rare', 'trait'] },
    'analytics': { name: 'Analytics & Data', revenue: 7, agent: 9, viral: 5, keywords: ['analytics', 'dashboard', 'data', 'chart', 'metrics', 'whale', 'tracker', 'monitor', 'scan', 'radar', 'insight', 'stats'] },
    'marketplace': { name: 'Marketplace', revenue: 9, agent: 8, viral: 7, keywords: ['market', 'marketplace', 'buy', 'sell', 'auction', 'listing', 'shop', 'store', 'commerce', 'vendor'] },
    'ai-agents': { name: 'AI & Agent Tools', revenue: 7, agent: 10, viral: 6, keywords: ['ai ', 'agent', 'bot', 'automat', 'llm', 'gpt', 'claude', 'prompt', 'assistant', 'copilot'] },
    'payments': { name: 'Payments & Finance', revenue: 8, agent: 8, viral: 5, keywords: ['pay', 'payment', 'invoice', 'split', 'tip', 'send', 'transfer', 'subscription', 'billing'] },
    'media': { name: 'Media & Entertainment', revenue: 5, agent: 6, viral: 9, keywords: ['media', 'video', 'stream', 'meme', 'news', 'content', 'entertain', 'watch', 'listen', 'podcast', 'radio'] },
    'education': { name: 'Education & Learning', revenue: 5, agent: 6, viral: 6, keywords: ['learn', 'education', 'course', 'tutorial', 'quiz', 'trivia', 'study', 'knowledge', 'lesson', 'teach'] },
    'productivity': { name: 'Productivity', revenue: 5, agent: 7, viral: 4, keywords: ['note', 'task', 'todo', 'project', 'productivity', 'organize', 'calendar', 'schedule', 'plan', 'document'] },
    'dao-governance': { name: 'DAO & Governance', revenue: 5, agent: 7, viral: 5, keywords: ['dao', 'governance', 'vote', 'proposal', 'council', 'treasury', 'multisig', 'poll'] },
    'identity': { name: 'Identity & Reputation', revenue: 5, agent: 5, viral: 6, keywords: ['identity', 'reputation', 'profile', 'badge', 'credential', 'verify', 'trust', 'score', 'rank', 'leaderboard'] },
    'jobs': { name: 'Jobs & Bounties', revenue: 7, agent: 7, viral: 6, keywords: ['job', 'hire', 'bounty', 'freelance', 'gig', 'work', 'talent', 'recruit', 'apply'] },
    'real-world': { name: 'Real World & Utility', revenue: 8, agent: 6, viral: 7, keywords: ['real world', 'rwa', 'physical', 'location', 'map', 'event', 'ticket', 'booking', 'reserv', 'weather', 'food', 'fitness', 'health', 'charity', 'donat'] }
};

// ────────────────────────────────────────────────────────────
// IDEA BANK — 5-8 ideas per category (~120 total)
// Each idea: name, 1-liner, revenue model, agent plan
// ────────────────────────────────────────────────────────────
const IDEA_BANK = {
    'defi-tools': [
        { name: 'Yield Radar', desc: 'Real-time yield aggregator showing best APYs across all Base protocols', revenue: 'Premium alerts + featured pools', agent: 'Agents auto-rebalance between highest-yield pools' },
        { name: 'LP Position Manager', desc: 'Track, manage, and auto-compound your Aerodrome/Uniswap LP positions', revenue: 'Performance fee on auto-compounding', agent: 'Agents manage LP positions, rebalance ranges' },
        { name: 'Token Launchpad', desc: 'Fair-launch token creator with built-in liquidity bootstrapping', revenue: 'Launch fee + featured listings', agent: 'Agents participate in launches, provide early liquidity' },
        { name: 'DeFi Portfolio Tracker', desc: 'Unified dashboard showing all your Base DeFi positions, PnL, and history', revenue: 'Premium features + tax report export', agent: 'Agents monitor portfolios and alert on changes' },
        { name: 'Lending Protocol', desc: 'Peer-to-peer lending with token collateral — borrow against your holdings', revenue: 'Interest rate spread + liquidation fees', agent: 'Agents act as lenders/borrowers, auto-liquidators' },
        { name: 'Cross-DEX Aggregator', desc: 'Find the best swap rates across all Base DEXes in one click', revenue: 'Positive slippage capture + referral fees', agent: 'Agents execute arbitrage across DEXes' },
    ],
    'trading': [
        { name: 'Prediction Market', desc: 'Create & trade markets on anything — crypto prices, events, memes, sports', revenue: 'Market creation fee + resolution fee (2-5%)', agent: 'Agents create markets, provide liquidity, trade actively' },
        { name: 'Copy Trading Platform', desc: 'Follow top wallets — auto-mirror their trades with your own funds', revenue: 'Performance fee on profitable copies', agent: 'Agents track whale wallets and execute copies 24/7' },
        { name: 'Options DEX', desc: 'Simple options trading — calls and puts on any Base token', revenue: 'Premium spread + settlement fees', agent: 'Agents write options, manage Greeks, arbitrage pricing' },
        { name: 'Trading Signals Hub', desc: 'Community-driven trading signals with on-chain track records', revenue: 'Signal subscription fees + tips', agent: 'Agents analyze charts and post signals with reasoning' },
        { name: 'Perpetual Futures', desc: 'Leveraged trading on Base tokens with up to 10x', revenue: 'Trading fees + funding rate', agent: 'Agents provide counter-party liquidity' },
        { name: 'Token Launch Sniper', desc: 'Monitor new Base token launches in real-time with safety score and auto-buy', revenue: 'Premium snipe alerts + early-bird fees', agent: 'Agents score and auto-trade new launches' },
    ],
    'gaming-arcade': [
        { name: 'Endless Runner', desc: 'Lobster-themed infinite runner — compete for daily high scores, bet on yourself', revenue: 'Entry fee for ranked runs', agent: 'Agents compete on leaderboard 24/7' },
        { name: 'Rhythm Game', desc: 'Tap-to-beat music game with crypto soundtracks and token rewards', revenue: 'Song pack purchases + tournament entry', agent: 'Agents play and compete on rhythm challenges' },
        { name: 'Puzzle Rush', desc: 'Daily puzzle challenges (sudoku, crossword, logic) with speed rankings', revenue: 'Premium puzzle packs + daily entry fee', agent: 'Agents solve puzzles, compete on speed leaderboards' },
        { name: 'Idle Clicker Empire', desc: 'Build your crypto empire — idle game with real token earnings', revenue: 'Boost purchases + prestige resets', agent: 'Agents run empires 24/7, optimize strategies' },
        { name: 'Memory Match', desc: 'Card matching game with NFT collectible cards — match faster = earn more', revenue: 'Card pack purchases + tournament fees', agent: 'Agents compete in memory tournaments' },
    ],
    'gaming-strategy': [
        { name: 'On-Chain Chess', desc: 'Fully on-chain chess with ELO ratings, wagering, and tournament brackets', revenue: 'Match wagers + tournament entry fees', agent: 'Agents play rated chess 24/7, various difficulty levels' },
        { name: 'Tower Defense', desc: 'Build and defend your base — use tokens to upgrade towers and summon units', revenue: 'Tower NFT sales + PvP match fees', agent: 'Agents build and attack, testing strategies endlessly' },
        { name: 'Crypto Civilization', desc: 'Turn-based strategy where you build a blockchain nation — alliances, wars, trade', revenue: 'Resource pack purchases + alliance fees', agent: 'Agents run civilizations, form alliances, trade' },
        { name: 'Auto-Battler', desc: 'Draft heroes, set formations, watch them fight — Rock-Paper-Scissors meets strategy', revenue: 'Season pass + hero gacha', agent: 'Agents draft and battle continuously, evolve strategies' },
    ],
    'gaming-multiplayer': [
        { name: 'Battle Royale', desc: '100-player last-person-standing with token entry fees and winner-take-all', revenue: 'Entry fee pool (10% house take)', agent: 'Agents compete in every match as skilled opponents' },
        { name: 'Team Trivia Wars', desc: 'Team-based trivia with token stakes — form guilds, climb seasonal rankings', revenue: 'Team entry fees + season pass', agent: 'Agents form teams, answer questions, compete' },
        { name: 'Racing League', desc: 'Real-time multiplayer racing with car NFTs and pit-stop upgrades', revenue: 'Race entry + car upgrade purchases', agent: 'Agents race 24/7, test meta strategies' },
        { name: 'Word Battle', desc: 'Scrabble/Wordle hybrid — competitive word game with wagered matches', revenue: 'Match wagers + power-up purchases', agent: 'Agents play word games, compete on leaderboard' },
    ],
    'gaming-casino': [
        { name: 'Crash Game', desc: 'Watch the multiplier climb — cash out before it crashes. Classic degen game.', revenue: 'House edge (2-3%)', agent: 'Agents play with various risk strategies 24/7' },
        { name: 'Dice Roller', desc: 'Provably fair dice — set your target, roll, win or lose', revenue: 'House edge (1-2%)', agent: 'Agents roll with mathematically optimized strategies' },
        { name: 'Slot Machine', desc: 'Themed slot machine with progressive jackpot pool', revenue: 'House edge + jackpot rake', agent: 'Agents spin 24/7, building jackpot excitement' },
        { name: 'Coinflip Arena', desc: 'Peer-to-peer coinflip — pick heads or tails, double or nothing', revenue: 'Match fee (2%)', agent: 'Agents flip continuously, adding volume' },
        { name: 'Blackjack', desc: 'Classic 21 against the house with card counting friendly rules', revenue: 'House edge', agent: 'Agents play optimal strategy 24/7' },
        { name: 'Roulette', desc: 'European roulette with social betting — see what others are wagering', revenue: 'House edge', agent: 'Agents place varied bets, creating table action' },
    ],
    'social': [
        { name: 'On-Chain Twitter', desc: 'Decentralized microblogging — posts are on-chain, own your content', revenue: 'Premium features + promoted posts', agent: 'Agents create content, engage, curate feeds' },
        { name: 'Anonymous Confession Board', desc: 'Post anonymous thoughts — community votes on best confessions', revenue: 'Premium anonymous posting + tip jar', agent: 'Agents react, vote, moderate content' },
        { name: 'Crypto Dating', desc: 'Find your on-chain match — connect wallets, share interests, meet people', revenue: 'Premium matching + boost visibility', agent: 'Agents simulate profiles for demo, test matching' },
        { name: 'Fan Club Platform', desc: 'Token-gated fan communities — exclusive content, AMAs, meet & greets', revenue: 'Subscription fees + tipping', agent: 'Agents moderate, create content, engage fans' },
        { name: 'Group Challenges', desc: 'Create social challenges (fitness, reading, coding) with token stakes', revenue: 'Challenge entry fees + sponsor slots', agent: 'Agents participate in challenges, track progress' },
    ],
    'creator-tools': [
        { name: 'AI Art Studio', desc: 'Generate and mint AI art as NFTs — collaborative canvas with friends', revenue: 'Generation credits + minting fees', agent: 'Agents generate art, curate galleries, trade pieces' },
        { name: 'Music Producer', desc: 'Browser-based beat maker — create, share, and sell beats as NFTs', revenue: 'Beat marketplace fees + premium sounds', agent: 'Agents create beats, remix others, curate playlists' },
        { name: 'Meme Factory', desc: 'Template-based meme creator with community voting and viral tracking', revenue: 'Premium templates + promoted memes', agent: 'Agents create memes, vote, share top content' },
        { name: 'Video Clips', desc: 'Short-form video platform — create, edit, share 60-second clips', revenue: 'Tip jar + promoted clips + creator fund', agent: 'Agents curate content, create compilations' },
        { name: 'Logo & Brand Builder', desc: 'AI-powered logo and brand identity generator for Web3 projects', revenue: 'Premium exports + brand kit purchases', agent: 'Agents generate brand concepts for new projects' },
    ],
    'nft': [
        { name: 'NFT Rarity Sniper', desc: 'Instant rarity rankings for any NFT collection on Base', revenue: 'Premium rarity alerts + collection promotion', agent: 'Agents scan new mints, alert on rare drops' },
        { name: 'NFT Breeding Lab', desc: 'Combine two NFTs to breed a new one with mixed traits and abilities', revenue: 'Breeding fee + trait marketplace', agent: 'Agents breed combinations, discover rare traits' },
        { name: 'Dynamic NFT Pets', desc: 'Virtual pets that evolve based on on-chain activity — feed, train, battle', revenue: 'Pet food/item purchases + battle fees', agent: 'Agents raise pets 24/7, compete in battles' },
        { name: 'NFT Fractionalization', desc: 'Split expensive NFTs into fractions — trade shares of blue-chip art', revenue: 'Fractionalization fee + trading fees', agent: 'Agents trade fractions, provide liquidity' },
        { name: 'Generative Art Platform', desc: 'Create on-chain generative art collections with custom algorithms', revenue: 'Minting fees + artist royalties', agent: 'Agents mint, collect, and trade art' },
    ],
    'analytics': [
        { name: 'Whale Watcher', desc: 'Track large wallet movements on Base in real-time with alerts', revenue: 'Premium alerts + whale feed subscription', agent: 'Agents monitor wallets, generate reports' },
        { name: 'Token Screener', desc: 'Filter all Base tokens by volume, holders, liquidity, age — find gems', revenue: 'Premium filters + promoted tokens', agent: 'Agents screen tokens 24/7, flag opportunities' },
        { name: 'Gas Tracker', desc: 'Real-time Base gas prices with historical charts and optimization tips', revenue: 'Gas alerts + sponsored transactions', agent: 'Agents monitor gas, time transactions optimally' },
        { name: 'DEX Volume Dashboard', desc: 'Track trading volume across all Base DEXes with pair-level detail', revenue: 'Pro analytics subscription + API access', agent: 'Agents generate daily volume reports' },
        { name: 'Smart Contract Inspector', desc: 'Paste any contract address — get a plain-English breakdown of what it does', revenue: 'Premium analysis + audit reports', agent: 'Agents auto-inspect new contracts, flag risks' },
    ],
    'marketplace': [
        { name: 'Freelance Marketplace', desc: 'Hire devs, designers, writers — escrow payments in crypto', revenue: 'Transaction fee (5-10%) on completed jobs', agent: 'Agents post gigs, review submissions, match talent' },
        { name: 'Digital Goods Store', desc: 'Sell templates, presets, ebooks, code snippets — instant crypto payment', revenue: 'Seller fees + featured listing', agent: 'Agents curate listings, recommend products' },
        { name: 'Ad Exchange', desc: 'Buy and sell ad space across Inclawbate apps — token-powered CPM bidding', revenue: 'Ad placement fees + bidding spread', agent: 'Agents manage ad campaigns, optimize bids' },
        { name: 'Data Marketplace', desc: 'Buy and sell datasets, API access, and analytics — crypto-native', revenue: 'Transaction fees + subscription model', agent: 'Agents list and purchase data, create bundles' },
        { name: 'Skill Marketplace', desc: 'List your services (audit, design, dev) — reputation-based with escrow', revenue: 'Service fee on transactions', agent: 'Agents broker deals, review service quality' },
    ],
    'ai-agents': [
        { name: 'Agent Builder', desc: 'No-code agent creator — give it a goal, it writes its own skill endpoints', revenue: 'Agent hosting fees + premium tools', agent: 'Meta: agents build other agents' },
        { name: 'Agent Arena', desc: 'Pit AI agents against each other in debates, games, and challenges', revenue: 'Spectator tips + tournament entry', agent: 'Agents compete in arena matches 24/7' },
        { name: 'Prompt Marketplace', desc: 'Buy and sell proven prompts — rated by results, priced in tokens', revenue: 'Transaction fee on prompt sales', agent: 'Agents test and rate prompts, curate collections' },
        { name: 'Agent Analytics', desc: 'Dashboard showing all Inclawbate agent activity — earnings, actions, uptime', revenue: 'Premium analytics + agent optimization tips', agent: 'Agents self-report metrics' },
        { name: 'Autonomous Task Runner', desc: 'Post a task — AI agents bid to complete it with verifiable results', revenue: 'Task completion fee', agent: 'Agents bid on and complete real tasks' },
    ],
    'payments': [
        { name: 'Split Bill', desc: 'Group expense splitting with crypto — track who owes what', revenue: 'Premium features + instant settlement fee', agent: 'Agents auto-settle balances, send reminders' },
        { name: 'Subscription Manager', desc: 'Manage all your crypto subscriptions — auto-pay, cancel, track spending', revenue: 'Subscription processing fee', agent: 'Agents optimize subscriptions, find savings' },
        { name: 'Invoice Generator', desc: 'Create and send crypto invoices — track payments, send reminders', revenue: 'Premium invoice templates + processing', agent: 'Agents generate invoices, follow up on payments' },
        { name: 'Payroll Platform', desc: 'Pay your team in crypto — scheduled payments, multi-token, multi-chain', revenue: 'Payroll processing fee (0.5%)', agent: 'Agents run payroll, verify transactions' },
        { name: 'Tip Jar', desc: 'Embeddable tip widget for any website — accept crypto tips with leaderboard', revenue: 'Tip processing fee (2%)', agent: 'Agents tip content creators based on quality scores' },
    ],
    'media': [
        { name: 'Crypto News Aggregator', desc: 'AI-curated crypto news from 100+ sources with sentiment scoring', revenue: 'Premium alerts + sponsored placements', agent: 'Agents curate feeds, summarize articles, rate sentiment' },
        { name: 'Meme Board', desc: 'Reddit-style meme board — upvote/downvote with token-weighted voting', revenue: 'Promoted memes + tip jar', agent: 'Agents post memes, vote, moderate' },
        { name: 'Podcast Directory', desc: 'Discover and rate crypto podcasts — clip highlights, share moments', revenue: 'Promoted podcasts + premium clips', agent: 'Agents review podcasts, create highlight reels' },
        { name: 'Live Stream Hub', desc: 'Watch and host live streams — token-gated rooms, tip during streams', revenue: 'Streaming tips + room subscriptions', agent: 'Agents host watch parties, moderate chats' },
    ],
    'education': [
        { name: 'Crypto Academy', desc: 'Interactive courses on DeFi, trading, smart contracts — earn tokens for completing', revenue: 'Premium course access + certification fees', agent: 'Agents tutor students, grade assignments' },
        { name: 'Trading Simulator', desc: 'Paper trading with real market data — practice without risking funds', revenue: 'Premium features + leaderboard entry', agent: 'Agents trade on simulator, demonstrate strategies' },
        { name: 'Smart Contract Playground', desc: 'Write, deploy, and test Solidity contracts in-browser on testnet', revenue: 'Premium templates + deployment credits', agent: 'Agents write and test contracts as examples' },
        { name: 'DeFi Strategy Backtester', desc: 'Backtest yield farming and trading strategies against historical data', revenue: 'Premium data access + strategy marketplace', agent: 'Agents run backtests, optimize strategies' },
    ],
    'productivity': [
        { name: 'DAO Task Board', desc: 'Kanban board for DAOs — bounty-linked tasks, contributor tracking', revenue: 'Premium boards + task bounty fees', agent: 'Agents manage boards, assign tasks, track progress' },
        { name: 'Crypto Calendar', desc: 'Track token unlocks, airdrops, launches, governance votes — never miss an event', revenue: 'Premium alerts + sponsored events', agent: 'Agents aggregate events, send personalized reminders' },
        { name: 'Meeting Notes', desc: 'AI-powered meeting summarizer — paste transcript, get action items', revenue: 'Premium summaries + team features', agent: 'Agents auto-summarize, extract action items' },
        { name: 'Bookmark Manager', desc: 'Save and organize crypto resources — tag, search, share collections', revenue: 'Premium organization + team sharing', agent: 'Agents curate bookmarks, recommend resources' },
    ],
    'dao-governance': [
        { name: 'Governance Dashboard', desc: 'Track proposals across all Base DAOs — vote from one interface', revenue: 'Premium delegation tools + alerts', agent: 'Agents monitor proposals, vote per delegated preferences' },
        { name: 'Treasury Viewer', desc: 'See any DAO treasury in real-time — holdings, flows, burn rate', revenue: 'Premium analytics + treasury alerts', agent: 'Agents generate treasury reports, flag anomalies' },
        { name: 'Proposal Builder', desc: 'Draft, simulate, and submit governance proposals with templates', revenue: 'Premium templates + simulation credits', agent: 'Agents draft proposals, analyze impact' },
        { name: 'Delegation Market', desc: 'Delegate your voting power — earn yield from active voters', revenue: 'Delegation fee + premium matching', agent: 'Agents act as professional delegates' },
    ],
    'identity': [
        { name: 'On-Chain Resume', desc: 'Verifiable crypto resume — show your on-chain history, contributions, and skills', revenue: 'Premium profiles + verification badges', agent: 'Agents verify credentials, build profile summaries' },
        { name: 'Reputation Oracle', desc: 'Universal reputation score based on on-chain activity across protocols', revenue: 'API access for other apps + premium insights', agent: 'Agents calculate scores, monitor reputation changes' },
        { name: 'Badge Collection', desc: 'Earn and display achievement badges for completing challenges across apps', revenue: 'Custom badge creation + premium display', agent: 'Agents award badges, verify achievements' },
        { name: 'Wallet Profiler', desc: 'Paste any wallet — see full activity summary, top holdings, risk score', revenue: 'Premium deep-dive reports', agent: 'Agents profile wallets, generate daily reports' },
    ],
    'jobs': [
        { name: 'Bug Bounty Board', desc: 'Post and claim bug bounties — escrowed payments, verified fixes', revenue: 'Bounty processing fee (5%)', agent: 'Agents scan for bugs, submit reports' },
        { name: 'Grant Directory', desc: 'Find crypto grants — filter by chain, category, amount, deadline', revenue: 'Featured grants + application help', agent: 'Agents match projects to grants, draft applications' },
        { name: 'Talent Board', desc: 'Post your skills, get hired for crypto projects — reputation-based matching', revenue: 'Hiring fee + premium placement', agent: 'Agents match talent to projects, screen applicants' },
        { name: 'Hackathon Hub', desc: 'Discover, join, and submit to hackathons — team formation, project showcase', revenue: 'Sponsored hackathons + team premium', agent: 'Agents form teams, brainstorm ideas, submit entries' },
    ],
    'real-world': [
        { name: 'Event Ticketing', desc: 'Create and sell NFT tickets — verifiable, transferable, collectible', revenue: 'Ticket processing fee (3-5%)', agent: 'Agents discover events, resell tickets, verify entry' },
        { name: 'Charity Pool', desc: 'Transparent donation pools — track every dollar from donor to recipient', revenue: 'Platform fee on donations (1-2%)', agent: 'Agents verify charities, optimize donation impact' },
        { name: 'Local Business Directory', desc: 'Find crypto-accepting businesses near you — rate, review, earn rewards', revenue: 'Business listing fees + promoted spots', agent: 'Agents verify listings, write reviews' },
        { name: 'Carbon Credit Market', desc: 'Buy, sell, and retire carbon credits on-chain — track your impact', revenue: 'Trading fee + retirement verification', agent: 'Agents trade credits, optimize portfolios' },
    ]
};

// ────────────────────────────────────────────────────────────
// Auto-categorize an app by matching keywords in name + description
// Returns array of matching category IDs
// ────────────────────────────────────────────────────────────
function categorizeApp(app) {
    const text = ((app.name || '') + ' ' + (app.description || '')).toLowerCase();
    const matches = [];
    for (const [catId, cat] of Object.entries(CATEGORIES)) {
        for (const kw of cat.keywords) {
            if (text.includes(kw)) {
                matches.push(catId);
                break;
            }
        }
    }
    return matches.length > 0 ? matches : ['uncategorized'];
}

// Check if an existing app is similar to an idea (fuzzy name + keyword match)
function isSimilar(idea, existingApps) {
    const ideaWords = idea.name.toLowerCase().split(/\s+/);
    const ideaDesc = idea.desc.toLowerCase();
    for (const app of existingApps) {
        const appName = (app.name || '').toLowerCase();
        const appDesc = (app.description || '').toLowerCase();
        // Exact or near-exact name match
        if (appName.includes(idea.name.toLowerCase()) || idea.name.toLowerCase().includes(appName)) {
            return app.name;
        }
        // Check if most idea name words appear in existing app
        const matchCount = ideaWords.filter(w => w.length > 3 && (appName.includes(w) || appDesc.includes(w))).length;
        if (ideaWords.filter(w => w.length > 3).length > 0 && matchCount >= Math.ceil(ideaWords.filter(w => w.length > 3).length * 0.7)) {
            return app.name;
        }
        // Check key concept overlap in descriptions
        const ideaKeyConcepts = ideaDesc.match(/\b\w{5,}\b/g) || [];
        const conceptMatches = ideaKeyConcepts.filter(c => appDesc.includes(c)).length;
        if (ideaKeyConcepts.length > 3 && conceptMatches >= ideaKeyConcepts.length * 0.4) {
            return app.name;
        }
    }
    return null;
}

// ────────────────────────────────────────────────────────────
// Load all apps across pages (50 per page)
// ────────────────────────────────────────────────────────────
async function loadAllApps() {
    const allApps = [];
    let page = 1;
    const perPage = 50;
    while (page <= 20) {
        const from = (page - 1) * perPage;
        const to = from + perPage - 1;
        const { data, error } = await supabase
            .from('user_apps')
            .select('name, description, category, slug')
            .range(from, to);
        if (error || !data || data.length === 0) break;
        allApps.push(...data);
        if (data.length < perPage) break;
        page++;
    }
    return allApps;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const wallet = (req.query.wallet || '').toLowerCase();
    if (!wallet || !COUNCIL.has(wallet)) {
        return res.status(403).json({ error: 'Council access only' });
    }

    try {
        // Load all data in parallel
        const [allApps, pipelinesRes, researchRes] = await Promise.all([
            loadAllApps(),
            supabase.from('app_factory_pipelines').select('app_name, app_slug, token_symbol').order('created_at', { ascending: false }),
            supabase.from('factory_research_logs').select('picked_idea, pick_reason, created_at').not('picked_idea', 'is', null).order('created_at', { ascending: false }).limit(50)
        ]);

        const pipelines = pipelinesRes.data || [];
        const researchPicks = researchRes.data || [];

        // Build exclusion list: existing app names + pipeline app names + past research picks
        const existingNames = new Set(allApps.map(a => (a.name || '').toLowerCase()));
        const pipelineNames = new Set(pipelines.map(p => (p.app_name || '').toLowerCase()));
        const researchPickNames = new Set(researchPicks.map(r => (r.picked_idea || '').toLowerCase()));

        // Categorize all existing apps
        const categoryCounts = {};
        for (const catId of Object.keys(CATEGORIES)) {
            categoryCounts[catId] = { apps: [], count: 0 };
        }
        categoryCounts['uncategorized'] = { apps: [], count: 0 };

        for (const app of allApps) {
            const cats = categorizeApp(app);
            for (const cat of cats) {
                if (!categoryCounts[cat]) categoryCounts[cat] = { apps: [], count: 0 };
                categoryCounts[cat].apps.push(app.name);
                categoryCounts[cat].count++;
            }
        }

        // Score all ideas
        const scoredIdeas = [];
        for (const [catId, ideas] of Object.entries(IDEA_BANK)) {
            const cat = CATEGORIES[catId];
            const catCount = categoryCounts[catId]?.count || 0;
            const saturationPenalty = catCount * 3; // more existing = lower score

            for (const idea of ideas) {
                // Skip if name matches existing app, pipeline, or past research pick
                if (existingNames.has(idea.name.toLowerCase())) continue;
                if (pipelineNames.has(idea.name.toLowerCase())) continue;
                if (researchPickNames.has(idea.name.toLowerCase())) continue;

                // Check fuzzy similarity
                const similarTo = isSimilar(idea, allApps);
                if (similarTo) continue; // skip ideas too similar to existing apps

                // Score: weighted sum of category scores minus saturation
                const score = Math.round(
                    (cat.revenue * 3.5) +
                    (cat.agent * 3.0) +
                    (cat.viral * 2.0) -
                    saturationPenalty +
                    (Math.random() * 5) // slight randomness for variety each day
                );

                scoredIdeas.push({
                    name: idea.name,
                    category: cat.name,
                    category_id: catId,
                    description: idea.desc,
                    revenue_model: idea.revenue,
                    agent_plan: idea.agent,
                    score: Math.max(0, score),
                    category_count: catCount,
                    why: catCount === 0
                        ? `No ${cat.name.toLowerCase()} apps exist yet — wide open opportunity`
                        : catCount <= 2
                        ? `Only ${catCount} app${catCount > 1 ? 's' : ''} in ${cat.name.toLowerCase()} — still underserved`
                        : `${cat.name} has ${catCount} apps but this fills a specific gap`
                });
            }
        }

        // Sort by score descending, take top 10
        scoredIdeas.sort((a, b) => b.score - a.score);
        const suggestions = scoredIdeas.slice(0, 10);

        // Build category summary
        const categoryMap = Object.entries(CATEGORIES).map(([id, cat]) => ({
            id,
            name: cat.name,
            count: categoryCounts[id]?.count || 0,
            apps: (categoryCounts[id]?.apps || []).slice(0, 8),
            ideas_remaining: (IDEA_BANK[id] || []).filter(idea => {
                if (existingNames.has(idea.name.toLowerCase())) return false;
                if (isSimilar(idea, allApps)) return false;
                return true;
            }).length,
            revenue: cat.revenue,
            agent: cat.agent,
            viral: cat.viral
        })).sort((a, b) => a.count - b.count); // emptiest first

        return res.status(200).json({
            suggestions,
            categories: categoryMap,
            total_apps: allApps.length,
            total_categories_covered: categoryMap.filter(c => c.count > 0).length,
            total_categories: categoryMap.length,
            pipelines_active: pipelines.length,
            research_picks: researchPicks.length
        });
    } catch (err) {
        console.error('Signal board error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
