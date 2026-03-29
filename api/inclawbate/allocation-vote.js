// Inclawbate — Allocation Vote
// POST { address, signature, message, weights, claws_balance }  → store signed vote
// GET                                                            → return aggregated synthesis
// No server-side RPC — balance is fetched client-side and sent with the vote

import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'ethers';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const COUNCIL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const COUNCIL_ROW_KEY = 'council';

const BUCKET_IDS = ['reinvest', 'buy-claws', 'claws-lp', 'staking', 'ecosystem', 'grants', 'philanthropy'];

function computeSynthesis(votes) {
    if (!votes || votes.length === 0) {
        return { synthesis: BUCKET_IDS.map(() => 0), totalVoters: 0, totalWeight: '0' };
    }

    // Equal weight: 1 person = 1 vote (not token-weighted)
    const sums = BUCKET_IDS.map(() => 0);
    let voterCount = 0;

    for (const vote of votes) {
        if (!vote.weights) continue;
        voterCount++;
        BUCKET_IDS.forEach((id, i) => {
            sums[i] += Number(vote.weights[id] || 0);
        });
    }

    const rawPcts = BUCKET_IDS.map((_, i) => voterCount > 0 ? sums[i] / voterCount : 0);
    const activeVoters = voterCount;

    // Round to integers, ensuring total = 100 and non-zero votes show at least 1%
    const rawTotal = rawPcts.reduce((a, b) => a + b, 0);
    if (rawTotal === 0) return { synthesis: BUCKET_IDS.map(() => 0), totalVoters: activeVoters, totalWeight: '0' };

    const scale = 100 / rawTotal;
    let synthesis = rawPcts.map(v => {
        const scaled = v * scale;
        // If someone voted for this category, show at least 1%
        return scaled > 0.1 ? Math.max(1, Math.round(scaled)) : 0;
    });

    // Adjust to sum to 100
    let adjTotal = synthesis.reduce((a, b) => a + b, 0);
    if (adjTotal !== 100) {
        // Find the largest category to absorb the difference
        const maxIdx = synthesis.indexOf(Math.max(...synthesis));
        synthesis[maxIdx] += (100 - adjTotal);
    }

    return { synthesis, totalVoters: activeVoters, totalWeight: String(voterCount) };
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

    const { address, signature, message, weights, type, claws_balance } = req.body || {};

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

        // Community vote — balance provided by client (fetched via browser RPC)
        const addrLower = address.toLowerCase();
        const clientBalance = (claws_balance && typeof claws_balance === 'string') ? claws_balance : '0';

        const { error: upsertErr } = await supabase
            .from('allocation_votes')
            .upsert({
                wallet_address: addrLower,
                weights,
                claws_balance: clientBalance,
                signature,
                message,
                updated_at: new Date().toISOString()
            }, { onConflict: 'wallet_address' });

        if (upsertErr) {
            console.error('Upsert vote error:', upsertErr);
            return res.status(500).json({ error: 'Failed to save vote' });
        }

        // Return updated synthesis
        const { data: allRows } = await supabase
            .from('allocation_votes')
            .select('wallet_address, weights, claws_balance');

        const communityVotes = (allRows || []).filter(v => v.wallet_address !== COUNCIL_ROW_KEY);
        const result = computeSynthesis(communityVotes);

        return res.status(200).json({
            success: true,
            message: 'Vote recorded',
            claws_balance: clientBalance,
            ...result
        });
    } catch (err) {
        console.error('Vote error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
