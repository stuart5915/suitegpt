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
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_ADDRESS = '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6';

const BUCKET_IDS = ['reinvest', 'buy-claws', 'claws-lp', 'staking', 'ecosystem', 'grants', 'philanthropy', 'council-comp'];

// ERC-20 balanceOf selector
const BALANCE_OF_SELECTOR = '0x70a08231';

async function getClawsBalance(address) {
    try {
        const paddedAddr = address.slice(2).toLowerCase().padStart(64, '0');
        const data = BALANCE_OF_SELECTOR + paddedAddr;

        // Check both wallet balance and staked balance
        const [walletRes, stakedRes] = await Promise.all([
            fetch('https://mainnet.base.org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1, method: 'eth_call',
                    params: [{ to: CLAWS_ADDRESS, data }, 'latest']
                })
            }),
            fetch('https://mainnet.base.org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 2, method: 'eth_call',
                    params: [{ to: STAKING_ADDRESS, data }, 'latest']
                })
            })
        ]);

        const [walletJson, stakedJson] = await Promise.all([walletRes.json(), stakedRes.json()]);
        const walletBal = BigInt(walletJson.result || '0x0');
        const stakedBal = BigInt(stakedJson.result || '0x0');
        const total = walletBal + stakedBal;

        // Return as string (18 decimals)
        return total.toString();
    } catch (err) {
        console.error('Failed to fetch CLAWS balance:', err);
        return '0';
    }
}

function computeSynthesis(votes) {
    if (!votes || votes.length === 0) {
        return { synthesis: BUCKET_IDS.map(() => 0), totalVoters: 0, totalWeight: '0' };
    }

    let totalWeight = BigInt(0);
    const weightedSums = BUCKET_IDS.map(() => BigInt(0));

    for (const vote of votes) {
        const bal = BigInt(vote.claws_balance || '0');
        // Minimum weight of 1 so even 0-balance wallets get a voice
        const weight = bal > BigInt(0) ? bal : BigInt(1);
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
        return { synthesis: adjusted, totalVoters: votes.length, totalWeight: totalWeight.toString() };
    }

    return { synthesis, totalVoters: votes.length, totalWeight: totalWeight.toString() };
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — return synthesis + individual votes
    if (req.method === 'GET') {
        try {
            const { data: votes } = await supabase
                .from('allocation_votes')
                .select('wallet_address, weights, claws_balance, updated_at')
                .order('claws_balance', { ascending: false });

            const result = computeSynthesis(votes || []);
            const voters = (votes || []).map(v => ({
                address: v.wallet_address,
                weights: v.weights,
                claws_balance: v.claws_balance,
                updated_at: v.updated_at
            }));
            return res.status(200).json({ success: true, ...result, voters, buckets: BUCKET_IDS });
        } catch (err) {
            console.error('Fetch synthesis error:', err);
            return res.status(500).json({ error: 'Failed to fetch synthesis' });
        }
    }

    // POST — cast vote
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { address, signature, message, weights } = req.body || {};

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
        // Fetch on-chain CLAWS balance
        const clawsBalance = await getClawsBalance(address);

        // Upsert vote (one vote per wallet)
        const { error: upsertErr } = await supabase
            .from('allocation_votes')
            .upsert({
                wallet_address: address.toLowerCase(),
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

        // Return updated synthesis
        const { data: allVotes } = await supabase
            .from('allocation_votes')
            .select('weights, claws_balance');

        const result = computeSynthesis(allVotes || []);

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
