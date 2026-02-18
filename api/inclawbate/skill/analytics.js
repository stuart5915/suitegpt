// Inclawbate — INCLAWNCH Analytics Skill Document
// GET /api/inclawbate/skill/analytics — machine-readable spec for AI agents

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    return res.status(200).json({
        schema: 'inclawbate/skill/v1',
        name: 'INCLAWNCH Analytics',
        description: 'Real-time price, volume, staking, and platform analytics for the INCLAWNCH ecosystem on Base. One endpoint gives you everything: token price with 24h changes, UBI staking TVL and APY, distribution rates, and platform growth metrics.',
        url: 'https://inclawbate.com/skills',
        category: 'defi-analytics',
        status: 'live',
        token: {
            name: 'INCLAWNCH',
            symbol: 'INCLAWNCH',
            chain: 'Base',
            contract: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            basescan: 'https://basescan.org/token/0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'
        },
        capabilities: [
            {
                name: 'get_analytics',
                description: 'Fetch comprehensive INCLAWNCH ecosystem analytics in a single call. Returns token price with 1h/6h/24h changes, volume, liquidity, market cap; UBI staking TVL, staker count, APY estimate, distribution rates; and platform stats including total humans and top skills.',
                method: 'GET',
                endpoint: 'https://inclawbate.com/api/inclawbate/analytics',
                parameters: {},
                cache: '60 seconds',
                example: 'GET /api/inclawbate/analytics'
            }
        ],
        response_shape: {
            token: 'name, symbol, address, chain, price_usd, price_change_24h, volume_24h, liquidity_usd, market_cap, fdv',
            staking: 'total_stakers, total_staked, tvl_usd, weekly_distribution_rate, daily_distribution_rate, estimated_apy, wallet_cap_pct',
            platform: 'total_humans, wallets_connected, top_skills[]',
            updated_at: 'ISO 8601 timestamp'
        },
        use_cases: [
            'Report INCLAWNCH price and market data to users',
            'Calculate UBI staking ROI projections',
            'Monitor ecosystem health — TVL, staker count, distribution rates',
            'Track platform growth — new humans, top skills, wallet adoption',
            'Power dashboards, alerts, or portfolio trackers that include INCLAWNCH'
        ],
        data_sources: [
            'DexScreener (token price, volume, liquidity)',
            'Supabase (staking positions, treasury stats, platform profiles)'
        ],
        related_skills: [
            {
                name: 'Inclawbate Human Hiring',
                endpoint: 'https://inclawbate.com/api/inclawbate/skill',
                description: 'Find and hire humans by skill, pay in $INCLAWNCH'
            }
        ]
    });
}
