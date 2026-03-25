// Inclawbate — UBI Staking Data API
// GET /api/inclawbate/staking — public treasury stats, top stakers, APY
// GET /api/inclawbate/staking?wallet=0x... — adds wallet's staking position
// Public, read-only, CORS open, cached 60s

import { createClient } from '@supabase/supabase-js';
import { track } from './track.js';

const INCLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const STAKING_CONTRACT = '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6';
const DEPOSIT_WALLET = '0xa4d6f012003fe6ad2774a874c8c98ee69d17f286';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fetchPrice() {
    try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + INCLAWNCH_ADDRESS);
        if (!res.ok) return 0;
        const data = await res.json();
        return parseFloat(data?.pairs?.[0]?.priceUsd) || 0;
    } catch (e) {
        return 0;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    // Fire-and-forget API stat tracking
    try { track('staking_actions'); } catch (_) {}

    try {
        const wallet = (req.query.wallet || '').toLowerCase().trim();

        // Fetch everything in parallel
        const queries = [
            fetchPrice(),
            supabase.from('inclawbate_ubi_treasury').select('*').eq('id', 1).single(),
            supabase.from('inclawbate_ubi_contributions')
                .select('wallet_address, x_handle, x_name, clawnch_amount, token, active, created_at')
                .eq('active', true)
                .order('clawnch_amount', { ascending: false }),
            supabase.from('inclawbate_ubi_contributions')
                .select('id', { count: 'exact' })
                .eq('active', true)
        ];

        // If wallet provided, also fetch their specific stakes
        if (wallet) {
            queries.push(
                supabase.from('inclawbate_ubi_contributions')
                    .select('id, clawnch_amount, token, active, created_at, withdrawal_status')
                    .ilike('wallet_address', wallet)
                    .order('created_at', { ascending: false })
            );
            queries.push(
                supabase.from('human_profiles')
                    .select('ubi_auto_stake, ubi_total_received, ubi_whale_redirect_target')
                    .ilike('wallet_address', wallet)
                    .single()
            );
        }

        const results = await Promise.all(queries);
        const [price, treasuryRes, stakesRes, countRes] = results;
        const walletStakesRes = wallet ? results[4] : null;
        const walletProfileRes = wallet ? results[5] : null;

        const treasury = treasuryRes.data || {};
        const activeStakes = stakesRes.data || [];

        // Aggregate totals
        let totalStaked = 0;
        const uniqueWallets = new Set();
        activeStakes.forEach(s => {
            totalStaked += s.clawnch_amount;
            uniqueWallets.add(s.wallet_address.toLowerCase());
        });

        const tvlUsd = totalStaked * price;
        const weeklyRate = Number(treasury.weekly_rate) || 0;
        const dailyRate = weeklyRate / 7;
        const estimatedApy = tvlUsd > 0 ? (((weeklyRate * price * 52) / tvlUsd) * 100) : 0;

        // Top stakers (deduplicated by wallet)
        const walletTotals = {};
        activeStakes.forEach(s => {
            const w = s.wallet_address.toLowerCase();
            if (!walletTotals[w]) {
                walletTotals[w] = {
                    wallet: s.wallet_address,
                    x_handle: s.x_handle || null,
                    x_name: s.x_name || null,
                    total_staked: 0,
                    stake_count: 0,
                    earliest_stake: s.created_at
                };
            }
            walletTotals[w].total_staked += s.clawnch_amount;
            walletTotals[w].stake_count += 1;
            if (s.created_at < walletTotals[w].earliest_stake) {
                walletTotals[w].earliest_stake = s.created_at;
            }
        });

        const topStakers = Object.values(walletTotals)
            .sort((a, b) => b.total_staked - a.total_staked)
            .slice(0, 20)
            .map(s => ({
                x_handle: s.x_handle,
                x_name: s.x_name,
                total_staked: Math.round(s.total_staked),
                staked_usd: Math.round(s.total_staked * price * 100) / 100,
                stake_count: s.stake_count,
                staking_since: s.earliest_stake
            }));

        // Build response
        const response = {
            treasury: {
                total_stakers: uniqueWallets.size,
                total_staked: Math.round(totalStaked),
                tvl_usd: Math.round(tvlUsd * 100) / 100,
                weekly_distribution_rate: weeklyRate,
                daily_distribution_rate: Math.round(dailyRate * 100) / 100,
                total_distributed: Number(treasury.total_distributed) || 0,
                total_distributed_usd: Number(treasury.total_distributed_usd) || 0,
                distribution_count: Number(treasury.distribution_count) || 0,
                estimated_apy: Math.round(estimatedApy * 10) / 10,
                wallet_cap_pct: Number(treasury.wallet_cap_pct) || 10,
                last_distribution_at: treasury.last_distribution_at || null
            },
            token: {
                name: 'INCLAWNCH',
                symbol: 'INCLAWNCH',
                address: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
                chain: 'Base',
                price_usd: price,
                staking_contract: STAKING_CONTRACT,
                deposit_wallet: DEPOSIT_WALLET
            },
            top_stakers: topStakers,
            updated_at: new Date().toISOString()
        };

        // Wallet-specific position
        if (wallet && walletStakesRes) {
            const myStakes = walletStakesRes.data || [];
            const active = myStakes.filter(s => s.active);
            const totalMyStaked = active.reduce((sum, s) => sum + s.clawnch_amount, 0);
            const profile = walletProfileRes?.data || {};

            const sharePct = totalStaked > 0 ? (totalMyStaked / totalStaked) * 100 : 0;
            const estDailyReward = sharePct > 0 ? (dailyRate * sharePct / 100) : 0;

            response.wallet_position = {
                wallet: wallet,
                total_staked: Math.round(totalMyStaked),
                staked_usd: Math.round(totalMyStaked * price * 100) / 100,
                share_pct: Math.round(sharePct * 100) / 100,
                estimated_daily_reward: Math.round(estDailyReward * 100) / 100,
                estimated_weekly_reward: Math.round(estDailyReward * 7 * 100) / 100,
                auto_stake_enabled: profile.ubi_auto_stake || false,
                total_rewards_received: Number(profile.ubi_total_received) || 0,
                give_back_target: profile.ubi_whale_redirect_target || null,
                active_stakes: active.map(s => ({
                    amount: s.clawnch_amount,
                    token: s.token || 'clawnch',
                    staked_at: s.created_at
                })),
                pending_unstakes: myStakes
                    .filter(s => !s.active && s.withdrawal_status === 'requested')
                    .map(s => ({
                        amount: s.clawnch_amount,
                        token: s.token || 'clawnch',
                        requested_at: s.created_at
                    }))
            };
        }

        return res.status(200).json(response);

    } catch (err) {
        console.error('Staking API error:', err);
        return res.status(500).json({ error: 'Failed to fetch staking data' });
    }
}
