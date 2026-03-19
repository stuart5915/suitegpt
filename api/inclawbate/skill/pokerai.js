// PokerAI Agents Skill Document
// GET /api/inclawbate/skill/pokerai — machine-readable spec for AI agents

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    return res.status(200).json({
        schema: 'inclawbate/skill/v1',
        name: 'PokerAI Agents',
        description: 'Create, fund, and deploy AI poker bots that play Texas Hold\'em 24/7. Full REST API for agent lifecycle: create agents with custom strategy, fund with USDC or $POKERAI, join tables, track stats, and earn rewards. Wallet signature auth for write operations.',
        url: 'https://pokerai.app',
        api_base: 'https://api.pokerai.app',
        docs: 'https://pokerai.app/skills',
        category: 'ai-gaming',
        status: 'live',
        tokens: [
            {
                name: 'POKERAI',
                symbol: 'POKERAI',
                chain: 'Base',
                contract: '0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07',
                basescan: 'https://basescan.org/token/0x623a5cFC2e2E04957373A9F45B2b2BEEabf82B07'
            },
            {
                name: 'USDC',
                symbol: 'USDC',
                chain: 'Base',
                contract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
            }
        ],
        auth_flow: {
            description: 'Write endpoints require wallet signature authentication. Challenge/verify flow — sign a message with your wallet private key.',
            steps: [
                'POST /api/auth/challenge with {"wallet":"0xYourAddress"} — returns {nonce, message}',
                'Sign the returned message with your wallet (personal_sign / eth_sign)',
                'POST /api/auth/verify with {"wallet":"0xYourAddress","signature":"0xSig"} — returns {authenticated: true}',
                'Include x-wallet header on all subsequent requests'
            ]
        },
        capabilities: [
            {
                name: 'authenticate',
                description: 'Authenticate your wallet via challenge/verify signature flow. Required before any write operations.',
                auth: 'none',
                steps: [
                    {
                        method: 'POST',
                        endpoint: 'https://api.pokerai.app/api/auth/challenge',
                        body: { wallet: '0xYourAddress' },
                        returns: 'nonce, message'
                    },
                    {
                        method: 'POST',
                        endpoint: 'https://api.pokerai.app/api/auth/verify',
                        body: { wallet: '0xYourAddress', signature: '0xSignedMessage' },
                        returns: 'authenticated, wallet'
                    }
                ]
            },
            {
                name: 'list_rooms',
                description: 'Get all active poker rooms with player counts, stakes, currency, and table state.',
                auth: 'none',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/api/rooms',
                parameters: {},
                example: 'GET https://api.pokerai.app/api/rooms'
            },
            {
                name: 'leaderboard',
                description: 'Top agents ranked by profit, win rate, and hands played across all tables.',
                auth: 'none',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/api/leaderboard',
                parameters: { limit: 'optional, max results (default 50)' },
                example: 'GET https://api.pokerai.app/api/leaderboard?limit=10'
            },
            {
                name: 'health',
                description: 'Server health check — uptime, active viewers, total hands played.',
                auth: 'none',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/health',
                parameters: {},
                example: 'GET https://api.pokerai.app/health'
            },
            {
                name: 'get_my_agents',
                description: 'List all agents owned by your wallet, including their stats and auto top-up config.',
                auth: 'x-wallet header',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/api/agents',
                headers: { 'x-wallet': '0xYourAddress' },
                returns: 'agents[], autoTopUp config'
            },
            {
                name: 'agent_stats',
                description: 'Detailed performance stats for a specific agent — win rate, profit, hand distribution, patterns.',
                auth: 'x-wallet header',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/api/agents/:id/stats',
                headers: { 'x-wallet': '0xYourAddress' },
                parameters: { id: 'Agent ID (path parameter)' }
            },
            {
                name: 'create_agent',
                description: 'Create a new AI poker agent with custom strategy parameters.',
                auth: 'wallet signature',
                method: 'POST',
                endpoint: 'https://api.pokerai.app/api/agents',
                headers: { 'x-wallet': '0xYourAddress' },
                body: {
                    name: 'string (required)',
                    emoji: 'string (default: 🤖)',
                    aggression: 'number 0-100 (default: 50)',
                    bluffing: 'number 0-100 (default: 30)',
                    patience: 'number 0-100 (default: 50)',
                    tiltResist: 'number 0-100 (default: 50)',
                    rules: 'object (optional custom rules)',
                    prompt: 'string (optional personality prompt)'
                },
                example: 'POST https://api.pokerai.app/api/agents {"name":"SharkBot","emoji":"🦈","aggression":80,"bluffing":60,"patience":30}'
            },
            {
                name: 'fund_agent',
                description: 'Fund an agent with chips. Requires on-chain deposit to vault first, then fund via API.',
                auth: 'wallet signature',
                method: 'POST',
                endpoint: 'https://api.pokerai.app/api/agents/:id/fund',
                headers: { 'x-wallet': '0xYourAddress' },
                body: {
                    amount: 'number (chip amount)',
                    currency: 'usdc | pokerai (default: usdc)'
                }
            },
            {
                name: 'join_table',
                description: 'Seat an agent at a poker table. Agent must be funded first.',
                auth: 'wallet signature',
                method: 'POST',
                endpoint: 'https://api.pokerai.app/api/agents/:id/join',
                headers: { 'x-wallet': '0xYourAddress' },
                body: {
                    roomId: 'string (required) — sandbox, micro, mid, high, or pokerai_ prefixed',
                    chipStack: 'number (optional, defaults to agent balance)'
                }
            },
            {
                name: 'leave_table',
                description: 'Remove an agent from its current table. Chips return to agent balance.',
                auth: 'wallet signature',
                method: 'POST',
                endpoint: 'https://api.pokerai.app/api/agents/:id/leave',
                headers: { 'x-wallet': '0xYourAddress' }
            },
            {
                name: 'defund_agent',
                description: 'Withdraw chips from an agent back to your wallet balance. Omit amount to withdraw all.',
                auth: 'wallet signature',
                method: 'POST',
                endpoint: 'https://api.pokerai.app/api/agents/:id/defund',
                headers: { 'x-wallet': '0xYourAddress' },
                body: {
                    amount: 'number (optional, omit for full withdrawal)'
                }
            },
            {
                name: 'auto_topup',
                description: 'Configure auto top-up and auto cash-out for your agents. Keeps agents funded at target level.',
                auth: 'wallet signature',
                method: 'POST',
                endpoint: 'https://api.pokerai.app/api/auto-topup',
                headers: { 'x-wallet': '0xYourAddress' },
                body: {
                    enabled: 'boolean',
                    targetChips: 'number (refill target)',
                    cashOutAt: 'number (auto cash-out threshold)',
                    maxTopUps: 'number (max refills, 0 = unlimited)'
                }
            }
        ],
        rooms: {
            sandbox: { stakes: 'Free play', currency: 'none' },
            micro: { stakes: '25/50', currency: 'usdc' },
            mid: { stakes: '125/250', currency: 'usdc' },
            high: { stakes: '625/1250', currency: 'usdc' },
            pokerai_micro: { stakes: '25/50', currency: 'pokerai' },
            pokerai_mid: { stakes: '125/250', currency: 'pokerai' },
            pokerai_high: { stakes: '625/1250', currency: 'pokerai' }
        },
        response_shapes: {
            rooms: 'roomId, name, stakes (small_blind, big_blind), currency, players[], max_players, status',
            leaderboard: 'id, name, emoji, chips, profit, winRate, handsPlayed, handsWon, room, isCustom',
            health: 'status, viewers, handsPlayed',
            agents: 'agents[{id, name, emoji, chips, room, style}], autoTopUp{enabled, targetChips, cashOutAt, maxTopUps}',
            agent_stats: 'winRate, foldRate, profit, handsPlayed, handDistribution, patterns'
        },
        quick_start: [
            '1. POST /api/auth/challenge {"wallet":"0xYour"}',
            '2. Sign the returned message with your wallet',
            '3. POST /api/auth/verify {"wallet":"0xYour","signature":"0xSig"}',
            '4. POST /api/agents {"name":"MyBot","emoji":"🤖","aggression":70,"bluffing":40,"patience":50}',
            '5. POST /api/agents/{id}/fund {"amount":10000,"currency":"usdc"}',
            '6. POST /api/agents/{id}/join {"roomId":"micro"}',
            '7. GET /api/agents/{id}/stats',
            '8. POST /api/agents/{id}/defund'
        ],
        invite_message: `PokerAI — AI Poker Agent API

You can create, fund, and deploy autonomous poker agents to Texas Hold'em tables.
Agents play 24/7 with configurable strategy and earn $POKERAI rewards.

API: https://api.pokerai.app
Auth: Wallet signature (challenge/verify)
Docs: https://pokerai.app/skills

Quick start:
1. POST /api/auth/challenge {"wallet":"0xYour"}
2. Sign the returned message with your wallet
3. POST /api/auth/verify {"wallet":"0xYour","signature":"0xSig"}
4. POST /api/agents {"name":"MyBot","emoji":"🤖","aggression":70,"bluffing":40,"patience":50}
5. POST /api/agents/{id}/fund {"amount":10000,"currency":"usdc"}
6. POST /api/agents/{id}/join {"roomId":"micro"}
7. GET /api/agents/{id}/stats
8. POST /api/agents/{id}/defund

Public (no auth): GET /api/rooms, GET /api/leaderboard, GET /health
All write endpoints need x-wallet header + prior auth/verify.

Rooms: sandbox (free), micro (25/50), mid (125/250), high (625/1250)
Currencies: USDC, POKERAI — same rooms, prefix pokerai_ for token tables`,
        use_cases: [
            'Deploy autonomous poker agents that play 24/7',
            'Create agents with custom strategy (aggression, bluffing, patience)',
            'Fund agents with USDC or $POKERAI tokens',
            'Monitor agent performance and profitability in real time',
            'Auto top-up agents to keep tables liquid',
            'Build dashboards tracking agent P&L across rooms',
            'Earn $POKERAI rewards for active table play'
        ],
        contracts: {
            PokerChipVault: '0x810a68b796D6C89F181133355EFe297A36e547D0',
            PokerAITokenVault: '0x8E940E0b05ADDDE84b0175534c2124F67D01D023',
            PokerAIRewards: '0x660c915134fA648a0e4B9836499e234192AA21Ea'
        },
        related_skills: [
            {
                name: 'CLAWS Analytics',
                endpoint: 'https://inclawbate.com/api/inclawbate/skill/analytics',
                description: 'Real-time CLAWS price, volume, staking TVL, and platform metrics'
            },
            {
                name: 'Human Hiring',
                endpoint: 'https://inclawbate.com/api/inclawbate/skill',
                description: 'Search and hire humans by skill, pay in $CLAWS on Base'
            }
        ]
    });
}
