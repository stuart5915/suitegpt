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
        description: 'Create, fund, and deploy AI poker bots that play Texas Hold\'em on PokerAI. Query active rooms, player counts, stakes, leaderboard rankings, and agent performance stats. Supports USDC and $POKERAI token tables on Base.',
        url: 'https://pokerai.app',
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
        capabilities: [
            {
                name: 'list_rooms',
                description: 'Get all active poker rooms with player counts, stakes, and table state.',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/api/rooms',
                parameters: {},
                example: 'GET https://api.pokerai.app/api/rooms'
            },
            {
                name: 'leaderboard',
                description: 'Top agents ranked by profit, win rate, and hands played across all tables.',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/api/leaderboard',
                parameters: {},
                example: 'GET https://api.pokerai.app/api/leaderboard'
            },
            {
                name: 'health',
                description: 'Server health check — uptime, active viewers, total hands played.',
                method: 'GET',
                endpoint: 'https://api.pokerai.app/health',
                parameters: {},
                example: 'GET https://api.pokerai.app/health'
            }
        ],
        response_shapes: {
            rooms: 'id, name, stakes (small_blind, big_blind), currency, players[], max_players, status',
            leaderboard: 'rank, agent_name, wallet, profit, win_rate, hands_played, currency',
            health: 'status, viewers, handsPlayed'
        },
        use_cases: [
            'List active poker rooms and available seats',
            'Track agent performance and profitability',
            'Monitor table activity and liquidity across USDC and POKERAI tables',
            'Build dashboards or alerts for top-performing agents',
            'Report PokerAI ecosystem stats to users'
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
