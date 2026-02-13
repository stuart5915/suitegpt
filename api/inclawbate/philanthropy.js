// Inclawbate — Philanthropy Vote
// GET  — public results (weighted by inCLAWNCH stake)
// GET  ?wallet=0x... — also returns user's vote + stake
// POST {wallet_address, philanthropy_pct} — upsert vote (must have active inCLAWNCH stakes)

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        // Fetch all votes
        const { data: votes } = await supabase
            .from('inclawbate_philanthropy_votes')
            .select('wallet_address, philanthropy_pct');

        // Fetch all active inCLAWNCH stakes (vote weight source)
        const { data: stakes } = await supabase
            .from('inclawbate_ubi_contributions')
            .select('wallet_address, clawnch_amount, token')
            .eq('active', true)
            .eq('token', 'inclawnch');

        // Build wallet → total inCLAWNCH stake map
        const stakeMap = {};
        (stakes || []).forEach(function(s) {
            const w = s.wallet_address;
            stakeMap[w] = (stakeMap[w] || 0) + (Number(s.clawnch_amount) || 0);
        });

        // Compute weighted results
        const voteMap = {};
        (votes || []).forEach(function(v) {
            voteMap[v.wallet_address] = v.philanthropy_pct;
        });

        let totalWeight = 0;
        let weightedPhilanthropy = 0;
        let voterCount = 0;

        for (const wallet in voteMap) {
            const stake = stakeMap[wallet] || 0;
            if (stake <= 0) continue; // no active inCLAWNCH = zero weight
            totalWeight += stake;
            weightedPhilanthropy += stake * voteMap[wallet];
            voterCount++;
        }

        const weightedPct = totalWeight > 0 ? weightedPhilanthropy / totalWeight : 0;

        const result = {
            weighted_philanthropy_pct: Math.round(weightedPct * 100) / 100,
            weighted_reinvest_pct: Math.round((100 - weightedPct) * 100) / 100,
            voter_count: voterCount,
            total_inclawnch_voting: Math.round(totalWeight)
        };

        // If wallet param, include user's vote + stake
        const walletParam = req.query.wallet;
        if (walletParam) {
            const w = walletParam.toLowerCase();
            const { data: myVote } = await supabase
                .from('inclawbate_philanthropy_votes')
                .select('philanthropy_pct')
                .eq('wallet_address', w)
                .single();

            result.my_vote = myVote ? myVote.philanthropy_pct : null;
            result.my_inclawnch_stake = stakeMap[w] || 0;
        }

        return res.status(200).json(result);
    }

    if (req.method === 'POST') {
        const { wallet_address, philanthropy_pct } = req.body;

        if (!wallet_address || typeof wallet_address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return res.status(400).json({ error: 'Valid wallet_address required' });
        }

        const pct = Number(philanthropy_pct);
        if (isNaN(pct) || pct < 0 || pct > 100 || !Number.isInteger(pct)) {
            return res.status(400).json({ error: 'philanthropy_pct must be an integer 0-100' });
        }

        const w = wallet_address.toLowerCase();

        // Verify wallet has active inCLAWNCH stakes
        const { data: activeStakes } = await supabase
            .from('inclawbate_ubi_contributions')
            .select('clawnch_amount')
            .eq('wallet_address', w)
            .eq('token', 'inclawnch')
            .eq('active', true);

        const totalStake = (activeStakes || []).reduce(function(sum, s) {
            return sum + (Number(s.clawnch_amount) || 0);
        }, 0);

        if (totalStake <= 0) {
            return res.status(403).json({ error: 'You must have active inCLAWNCH stakes to vote' });
        }

        // Upsert vote
        const { error: upsertErr } = await supabase
            .from('inclawbate_philanthropy_votes')
            .upsert({
                wallet_address: w,
                philanthropy_pct: pct,
                updated_at: new Date().toISOString()
            }, { onConflict: 'wallet_address' });

        if (upsertErr) {
            return res.status(500).json({ error: 'Failed to save vote' });
        }

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
