// Inclawbate — Allocation Vote
// POST { address, signature, message, weights }  → store signed vote
// GET                                             → return aggregated synthesis

import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'ethers';

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

const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_CONTRACTS = [
    '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6', // InclawnchStaking
    '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40'  // CLAWS staking pool
];
const COUNCIL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const COUNCIL_ROW_KEY = 'council';
const BASE_RPCS = [
    'https://base-rpc.publicnode.com',
    'https://1rpc.io/base',
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
    'https://base.meowrpc.com'
];

const BUCKET_IDS = ['reinvest', 'buy-claws', 'claws-lp', 'staking', 'ecosystem', 'grants', 'philanthropy'];

// Batched RPC — send all eth_call requests in a single HTTP request
async function batchRpcCalls(calls) {
    const batch = calls.map((c, i) => ({
        jsonrpc: '2.0', id: i, method: 'eth_call',
        params: [{ to: c.to, data: c.data }, 'latest']
    }));

    for (const rpc of BASE_RPCS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const json = await res.json();

            if (Array.isArray(json)) {
                const results = new Array(calls.length).fill('0x0');
                let successCount = 0;
                for (const item of json) {
                    if (item.result && item.result !== '0x' && item.result.length > 2) {
                        results[item.id] = item.result;
                        successCount++;
                    }
                }
                // Only accept if we got at least SOME successful results
                if (successCount > 0) return results;
                // All returned 0x or errors — try next RPC
                console.log('Batch returned 0 successes from', rpc, '— trying next');
            }
        } catch (err) {
            clearTimeout(timeout);
            console.error('Batch RPC error via', rpc, err.message);
        }
    }
    return new Array(calls.length).fill('0x0');
}

async function getClawsBalance(address) {
    const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
    const balanceOfData = '0x70a08231' + paddedAddr;

    const contracts = [CLAWS_ADDRESS, ...STAKING_CONTRACTS];
    const calls = contracts.map(c => ({ to: c, data: balanceOfData }));
    const results = await batchRpcCalls(calls);

    let total = BigInt(0);
    for (const hex of results) {
        try { total += BigInt(hex); } catch (e) { /* skip bad hex */ }
    }
    console.log('Balance for', address, ':', total.toString());
    return total.toString();
}

// Bulk fetch balances for multiple addresses in ONE batch request
async function getClawsBalancesBulk(addresses) {
    const contracts = [CLAWS_ADDRESS, ...STAKING_CONTRACTS];
    const calls = [];
    for (const addr of addresses) {
        const paddedAddr = addr.slice(2).toLowerCase().padStart(64, '0');
        const balanceOfData = '0x70a08231' + paddedAddr;
        for (const c of contracts) {
            calls.push({ to: c, data: balanceOfData });
        }
    }

    const results = await batchRpcCalls(calls);
    const balances = {};
    const perAddr = contracts.length;

    for (let i = 0; i < addresses.length; i++) {
        let total = BigInt(0);
        for (let j = 0; j < perAddr; j++) {
            try { total += BigInt(results[i * perAddr + j]); } catch (e) { /* skip */ }
        }
        balances[addresses[i].toLowerCase()] = total.toString();
    }
    return balances;
}

function computeSynthesis(votes) {
    if (!votes || votes.length === 0) {
        return { synthesis: BUCKET_IDS.map(() => 0), totalVoters: 0, totalWeight: '0' };
    }

    let totalWeight = BigInt(0);
    const weightedSums = BUCKET_IDS.map(() => BigInt(0));

    for (const vote of votes) {
        const bal = BigInt(vote.claws_balance || '0');
        // Skip 0-balance wallets — no CLAWS = no vote weight
        if (bal === BigInt(0)) continue;
        const weight = bal;
        totalWeight += weight;

        BUCKET_IDS.forEach((id, i) => {
            const pct = BigInt(vote.weights[id] || 0);
            weightedSums[i] += pct * weight;
        });
    }

    const synthesis = BUCKET_IDS.map((_, i) => {
        if (totalWeight === BigInt(0)) return 0;
        return Number(weightedSums[i] / totalWeight);
    });

    // Normalize to 100
    const synthTotal = synthesis.reduce((a, b) => a + b, 0);
    if (synthTotal > 0 && synthTotal !== 100) {
        const scale = 100 / synthTotal;
        let adjusted = synthesis.map(v => Math.round(v * scale));
        const adjTotal = adjusted.reduce((a, b) => a + b, 0);
        if (adjTotal !== 100) adjusted[0] += (100 - adjTotal);
        const activeVoters = votes.filter(v => BigInt(v.claws_balance || '0') > BigInt(0)).length;
        return { synthesis: adjusted, totalVoters: activeVoters, totalWeight: totalWeight.toString() };
    }

    const activeVoters = votes.filter(v => BigInt(v.claws_balance || '0') > BigInt(0)).length;
    return { synthesis, totalVoters: activeVoters, totalWeight: totalWeight.toString() };
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — return synthesis + individual votes + council allocation
    if (req.method === 'GET') {
        try {
            // One-time restore of correct on-chain balances (verified locally via RPC)
            if (req.query.fix === 'restore2') {
                const fixes = {
                    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd': '1365193972602627527416268262',
                    '0x612abfe54269515f0cc63b4a12fee32d48889ff2': '1005170918949221126768270768',
                    '0x1ecafe4a4c9960659d1d14257e4989dbf0dcf2cd': '333225933380531489641258631',
                    '0xba9b369a75e216cc9d73c9f3f916c939a5755a08': '3069604908176768714053772',
                    '0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3': '1008860714798496041677981449'
                };
                const results = [];
                for (const [addr, bal] of Object.entries(fixes)) {
                    await supabase.from('allocation_votes')
                        .update({ claws_balance: bal })
                        .eq('wallet_address', addr);
                    results.push({ address: addr, restored: bal });
                }
                return res.status(200).json({ fixed: results });
            }

            // Admin refresh: GET ?refresh=admin to re-fetch all on-chain balances (single batch)
            if (req.query.refresh === 'admin') {
                const { data: rows } = await supabase
                    .from('allocation_votes')
                    .select('wallet_address, claws_balance')
                    .neq('wallet_address', COUNCIL_ROW_KEY);
                if (!rows || rows.length === 0) {
                    return res.status(200).json({ refreshed: [] });
                }
                const addresses = rows.map(v => v.wallet_address);
                const freshBalances = await getClawsBalancesBulk(addresses);
                const results = [];
                for (const v of rows) {
                    const fresh = freshBalances[v.wallet_address.toLowerCase()] || '0';
                    const oldBal = BigInt(v.claws_balance || '0');
                    const newBal = BigInt(fresh);
                    // Safety: never overwrite with a LOWER balance (staking RPCs fail from Vercel)
                    if (newBal < oldBal) {
                        results.push({ address: v.wallet_address, old: v.claws_balance, new: fresh, skipped: 'kept existing (new < old, likely RPC failure)' });
                        continue;
                    }
                    await supabase.from('allocation_votes')
                        .update({ claws_balance: fresh })
                        .eq('wallet_address', v.wallet_address);
                    results.push({ address: v.wallet_address, old: v.claws_balance, new: fresh });
                }
                return res.status(200).json({ refreshed: results });
            }

            const { data: allRows } = await supabase
                .from('allocation_votes')
                .select('wallet_address, weights, claws_balance, updated_at')
                .order('claws_balance', { ascending: false });

            const councilRow = (allRows || []).find(v => v.wallet_address === COUNCIL_ROW_KEY);
            const communityVotes = (allRows || []).filter(v => v.wallet_address !== COUNCIL_ROW_KEY);

            const result = computeSynthesis(communityVotes);
            const voters = communityVotes.map(v => ({
                address: v.wallet_address,
                weights: v.weights,
                claws_balance: v.claws_balance,
                updated_at: v.updated_at
            }));
            return res.status(200).json({
                success: true,
                ...result,
                voters,
                council: councilRow ? councilRow.weights : null,
                councilUpdatedAt: councilRow ? councilRow.updated_at : null,
                buckets: BUCKET_IDS
            });
        } catch (err) {
            console.error('Fetch synthesis error:', err);
            return res.status(500).json({ error: 'Failed to fetch synthesis' });
        }
    }

    // POST — cast vote (community or council)
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { address, signature, message, weights, type } = req.body || {};

    if (!address || !signature || !message || !weights) {
        return res.status(400).json({ error: 'address, signature, message, and weights required' });
    }

    // Validate weights
    if (typeof weights !== 'object') {
        return res.status(400).json({ error: 'weights must be an object' });
    }
    let total = 0;
    for (const id of BUCKET_IDS) {
        const v = weights[id];
        if (typeof v !== 'number' || v < 0 || v > 100) {
            return res.status(400).json({ error: 'Each weight must be 0-100' });
        }
        total += v;
    }
    if (total !== 100) {
        return res.status(400).json({ error: 'Weights must sum to 100' });
    }

    // Verify timestamp (5-minute window)
    const tsMatch = message.match(/Timestamp: (\d+)/);
    if (!tsMatch) {
        return res.status(400).json({ error: 'Invalid message format' });
    }
    const ts = parseInt(tsMatch[1]);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
        return res.status(400).json({ error: 'Message expired, please sign again' });
    }

    // Verify signature matches address
    let recoveredAddress;
    try {
        recoveredAddress = verifyMessage(message, signature);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({ error: 'Signature does not match address' });
    }

    // Verify weights are embedded in the message
    const weightsStr = JSON.stringify(weights);
    if (!message.includes(weightsStr)) {
        return res.status(400).json({ error: 'Signed message does not match submitted weights' });
    }

    try {
        // Council allocation — only the council wallet can set this
        if (type === 'council') {
            if (address.toLowerCase() !== COUNCIL_WALLET) {
                return res.status(403).json({ error: 'Only the council wallet can set allocation' });
            }
            const { error: upsertErr } = await supabase
                .from('allocation_votes')
                .upsert({
                    wallet_address: COUNCIL_ROW_KEY,
                    weights,
                    claws_balance: '0',
                    signature,
                    message,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'wallet_address' });

            if (upsertErr) {
                console.error('Council upsert error:', upsertErr);
                return res.status(500).json({ error: 'Failed to save council allocation' });
            }
            return res.status(200).json({ success: true, message: 'Council allocation set', council: weights });
        }

        // Community vote — keep existing balance, only fetch for NEW voters
        const addrLower = address.toLowerCase();
        const { data: existing } = await supabase
            .from('allocation_votes')
            .select('claws_balance')
            .eq('wallet_address', addrLower)
            .maybeSingle();

        let clawsBalance = existing ? (existing.claws_balance || '0').toString() : null;
        if (!clawsBalance || clawsBalance === '0') {
            // New voter or had 0 — try to fetch on-chain
            clawsBalance = await getClawsBalance(address);
        }

        const { error: upsertErr } = await supabase
            .from('allocation_votes')
            .upsert({
                wallet_address: addrLower,
                weights,
                claws_balance: clawsBalance,
                signature,
                message,
                updated_at: new Date().toISOString()
            }, { onConflict: 'wallet_address' });

        if (upsertErr) {
            console.error('Upsert vote error:', upsertErr);
            return res.status(500).json({ error: 'Failed to save vote' });
        }

        // Return updated synthesis (exclude council row)
        const { data: allRows } = await supabase
            .from('allocation_votes')
            .select('wallet_address, weights, claws_balance');

        const communityVotes = (allRows || []).filter(v => v.wallet_address !== COUNCIL_ROW_KEY);
        const result = computeSynthesis(communityVotes);

        return res.status(200).json({
            success: true,
            message: 'Vote recorded',
            claws_balance: clawsBalance,
            ...result
        });
    } catch (err) {
        console.error('Vote error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
