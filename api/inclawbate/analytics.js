// Inclawbate — INCLAWNCH Analytics API
// GET /api/inclawbate/analytics — aggregated token, staking, and platform data for agents
// Public, read-only, CORS open, cached 60s

import { createClient } from '@supabase/supabase-js';

const CLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const INCLAWNCH_ADDRESS = '0xb0b6e0e9da530f68d713cc03a813b506205ac808';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchDexScreener(address) {
    try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + address);
        if (!res.ok) return null;
        const data = await res.json();
        const pair = data?.pairs?.[0];
        if (!pair) return null;
        return {
            price_usd: parseFloat(pair.priceUsd) || 0,
            price_change_1h: pair.priceChange?.h1 ?? null,
            price_change_6h: pair.priceChange?.h6 ?? null,
            price_change_24h: pair.priceChange?.h24 ?? null,
            volume_24h: pair.volume?.h24 ?? 0,
            volume_6h: pair.volume?.h6 ?? 0,
            liquidity_usd: pair.liquidity?.usd ?? 0,
            market_cap: pair.marketCap ?? null,
            fdv: pair.fdv ?? null,
            pair_address: pair.pairAddress || null,
            dex: pair.dexId || null
        };
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Fetch everything in parallel
        const [clawnchData, inclawnchData, treasuryRes, stakesRes, statsRes] = await Promise.all([
            fetchDexScreener(CLAWNCH_ADDRESS),
            fetchDexScreener(INCLAWNCH_ADDRESS),
            supabase.from('inclawbate_ubi_treasury').select('*').eq('id', 1).single(),
            supabase.from('inclawbate_ubi_contributions')
                .select('wallet_address, clawnch_amount, token')
                .eq('active', true),
            supabase.from('human_profiles')
                .select('id, wallet_address, skills, hire_count, availability', { count: 'exact' })
        ]);

        // Staking aggregation
        const activeStakes = stakesRes.data || [];
        const uniqueWallets = new Set(activeStakes.map(r => r.wallet_address));
        let clawnchStaked = 0, inclawnchStaked = 0;
        activeStakes.forEach(s => {
            if (s.token === 'inclawnch') inclawnchStaked += s.clawnch_amount;
            else clawnchStaked += s.clawnch_amount;
        });

        const clawnchPrice = clawnchData?.price_usd || 0;
        const inclawnchPrice = inclawnchData?.price_usd || 0;
        const tvlUsd = (clawnchStaked * clawnchPrice) + (inclawnchStaked * inclawnchPrice);

        const treasury = treasuryRes.data || {};
        const weeklyRate = Number(treasury.weekly_rate) || 0;
        const dailyRate = weeklyRate / 7;
        const weeklyDistUsd = weeklyRate * clawnchPrice;

        // Estimate APY: (annual distribution USD / TVL USD) * 100
        const estimatedApy = tvlUsd > 0 ? ((weeklyDistUsd * 52) / tvlUsd) * 100 : 0;

        // Platform stats
        const profiles = statsRes.data || [];
        const walletsConnected = profiles.filter(p => p.wallet_address).length;

        // Skill counts
        const skillCounts = {};
        profiles.forEach(p => {
            (p.skills || []).forEach(s => { skillCounts[s] = (skillCounts[s] || 0) + 1; });
        });
        const topSkills = Object.entries(skillCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([skill, count]) => ({ skill, count }));

        return res.status(200).json({
            tokens: {
                clawnch: {
                    address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
                    chain: 'Base',
                    ...(clawnchData || { price_usd: 0 })
                },
                inclawnch: {
                    address: '0xB0b6e0E9da530f68D713cC03a813B506205aC808',
                    chain: 'Base',
                    ...(inclawnchData || { price_usd: 0 })
                }
            },
            staking: {
                total_stakers: uniqueWallets.size,
                clawnch_staked: Math.round(clawnchStaked),
                inclawnch_staked: Math.round(inclawnchStaked),
                tvl_usd: Math.round(tvlUsd * 100) / 100,
                weekly_distribution_rate: weeklyRate,
                daily_distribution_rate: Math.round(dailyRate * 100) / 100,
                total_distributed: Number(treasury.total_distributed) || 0,
                total_distributed_usd: Number(treasury.total_distributed_usd) || 0,
                estimated_apy: Math.round(estimatedApy * 10) / 10,
                wallet_cap_pct: Number(treasury.wallet_cap_pct) || 10
            },
            platform: {
                total_humans: statsRes.count || profiles.length,
                wallets_connected: walletsConnected,
                top_skills: topSkills
            },
            updated_at: new Date().toISOString()
        });

    } catch (err) {
        console.error('Analytics error:', err);
        return res.status(500).json({ error: 'Failed to fetch analytics' });
    }
}
