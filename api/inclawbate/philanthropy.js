// Inclawbate — Philanthropy Vote
// GET  — public results (weighted by live on-chain balances: CLAWNCH 1x, inCLAWNCH 2x)
// GET  ?wallet=0x... — also returns user's vote + balance
// POST {wallet_address, philanthropy_pct} — upsert vote (must hold CLAWNCH or inCLAWNCH)

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const CLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const INCLAWNCH_ADDRESS = '0xb0b6e0e9da530f68d713cc03a813b506205ac808';
const BALANCE_SELECTOR = '0x70a08231';

const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function pad32(hex) {
    return hex.replace('0x', '').padStart(64, '0');
}

async function rpcCall(method, params) {
    for (let i = 0; i < BASE_RPCS.length; i++) {
        try {
            const resp = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            if (resp.status === 429) continue;
            const data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { /* try next */ }
    }
    return null;
}

// Fetch CLAWNCH + inCLAWNCH balances for a single wallet
async function getWalletBalances(wallet) {
    const callData = BALANCE_SELECTOR + pad32(wallet);
    const [clRes, inRes] = await Promise.all([
        rpcCall('eth_call', [{ to: CLAWNCH_ADDRESS, data: callData }, 'latest']),
        rpcCall('eth_call', [{ to: INCLAWNCH_ADDRESS, data: callData }, 'latest'])
    ]);
    const clawnch = clRes ? Number(BigInt(clRes)) / 1e18 : 0;
    const inclawnch = inRes ? Number(BigInt(inRes)) / 1e18 : 0;
    return { clawnch, inclawnch, weight: clawnch + (inclawnch * 2) };
}

// Batch-fetch balances for multiple wallets in parallel
async function getBatchBalances(wallets) {
    const results = await Promise.all(wallets.map(w => getWalletBalances(w)));
    const map = {};
    wallets.forEach(function(w, i) { map[w] = results[i]; });
    return map;
}

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

        const voterWallets = (votes || []).map(v => v.wallet_address);

        // Include queried wallet in the batch if not already a voter
        const walletParam = req.query.wallet ? req.query.wallet.toLowerCase() : null;
        const allWallets = walletParam && !voterWallets.includes(walletParam)
            ? [...voterWallets, walletParam]
            : voterWallets;

        // Fetch live on-chain balances for all voters (+ queried wallet)
        const balanceMap = allWallets.length > 0 ? await getBatchBalances(allWallets) : {};

        // Compute weighted results
        let totalWeight = 0;
        let weightedPhilanthropy = 0;
        let voterCount = 0;
        let totalClawnch = 0;
        let totalInclawnch = 0;

        for (const vote of (votes || [])) {
            const bal = balanceMap[vote.wallet_address];
            const weight = bal ? bal.weight : 0;
            if (weight <= 0) continue; // sold tokens = zero weight
            totalWeight += weight;
            weightedPhilanthropy += weight * vote.philanthropy_pct;
            totalClawnch += bal.clawnch;
            totalInclawnch += bal.inclawnch;
            voterCount++;
        }

        const weightedPct = totalWeight > 0 ? weightedPhilanthropy / totalWeight : 0;

        // Fetch kingdom total from treasury
        let kingdomTotal = 0;
        try {
            const { data: treasury } = await supabase
                .from('inclawbate_ubi_treasury')
                .select('kingdom_total_distributed')
                .limit(1)
                .single();
            if (treasury && treasury.kingdom_total_distributed) {
                kingdomTotal = Number(treasury.kingdom_total_distributed);
            }
        } catch (e) { /* column may not exist yet */ }

        const result = {
            weighted_philanthropy_pct: Math.round(weightedPct * 100) / 100,
            weighted_reinvest_pct: Math.round((100 - weightedPct) * 100) / 100,
            voter_count: voterCount,
            total_weighted_voting: Math.round(totalWeight),
            total_clawnch_voting: Math.round(totalClawnch),
            total_inclawnch_voting: Math.round(totalInclawnch),
            kingdom_total_distributed: kingdomTotal
        };

        // If wallet param, include user's vote + live balance
        if (walletParam) {
            const { data: myVote } = await supabase
                .from('inclawbate_philanthropy_votes')
                .select('philanthropy_pct')
                .eq('wallet_address', walletParam)
                .single();

            const bal = balanceMap[walletParam] || { clawnch: 0, inclawnch: 0, weight: 0 };
            result.my_vote = myVote ? myVote.philanthropy_pct : null;
            result.my_voting_power = Math.round(bal.weight);
            result.my_clawnch = Math.round(bal.clawnch);
            result.my_inclawnch = Math.round(bal.inclawnch);
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

        // Verify wallet holds CLAWNCH or inCLAWNCH (live on-chain check)
        const bal = await getWalletBalances(w);

        if (bal.weight <= 0) {
            return res.status(403).json({ error: 'You must hold CLAWNCH or inCLAWNCH to vote' });
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
