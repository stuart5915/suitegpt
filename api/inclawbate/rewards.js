// Inclawbate — Weekly Rewards Config + Pool Funding
// GET  — public, returns reward config + recent contributors
// POST {action:"update-config", ...} — admin wallet only, updates config
// POST {action:"pool-deposit", tx_hash, wallet_address} — anyone, fund the pool

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const CLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// RPC with fallback
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

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

async function verifyClawnchTransfer(txHash) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Transaction failed or not found' };
    }

    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === CLAWNCH_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No CLAWNCH transfer found in transaction' };
    }

    const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
    const from = '0x' + transferLog.topics[1].slice(26).toLowerCase();
    const amount = Number(BigInt(transferLog.data)) / 1e18;

    if (to !== PROTOCOL_WALLET) {
        return { valid: false, reason: 'Transfer was not sent to the protocol wallet' };
    }

    if (amount <= 0) {
        return { valid: false, reason: 'Transfer amount is zero' };
    }

    return { valid: true, amount, from };
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
        // Get config
        const { data: config } = await supabase
            .from('inclawbate_rewards')
            .select('*')
            .eq('id', 1)
            .single();

        // Get recent contributors for this week
        let contributors = [];
        try {
            const { data: contribs } = await supabase
                .from('inclawbate_pool_contributions')
                .select('wallet_address, x_handle, x_name, clawnch_amount, created_at')
                .order('created_at', { ascending: false })
                .limit(20);
            contributors = contribs || [];
        } catch (e) { /* table may not exist yet */ }

        const result = config || {
            current_pool: 1000000,
            next_pool: 1000000,
            last_distributed: 0,
            total_distributed: 0,
            week_ends_at: null,
            top_n: 10
        };

        result.contributors = contributors;
        return res.status(200).json(result);
    }

    if (req.method === 'POST') {
        const { action } = req.body;

        // Admin config update
        if (action === 'update-config') {
            const { wallet_address, current_pool, next_pool, last_distributed, total_distributed, week_ends_at, top_n } = req.body;

            if (!wallet_address || wallet_address.toLowerCase() !== SUPER_ADMIN) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const updates = { updated_at: new Date().toISOString() };
            if (current_pool !== undefined) updates.current_pool = current_pool;
            if (next_pool !== undefined) updates.next_pool = next_pool;
            if (last_distributed !== undefined) updates.last_distributed = last_distributed;
            if (total_distributed !== undefined) updates.total_distributed = total_distributed;
            if (week_ends_at !== undefined) updates.week_ends_at = week_ends_at;
            if (top_n !== undefined) updates.top_n = top_n;

            const { data, error } = await supabase
                .from('inclawbate_rewards')
                .update(updates)
                .eq('id', 1)
                .select('*')
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to update', detail: error.message });
            }

            return res.status(200).json(data);
        }

        // Community pool deposit
        if (action === 'pool-deposit') {
            const { tx_hash, wallet_address } = req.body;

            if (!tx_hash || typeof tx_hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
                return res.status(400).json({ error: 'Valid tx_hash required' });
            }

            if (!wallet_address) {
                return res.status(400).json({ error: 'wallet_address required' });
            }

            // Check duplicate
            const { data: existing } = await supabase
                .from('inclawbate_pool_contributions')
                .select('id')
                .eq('tx_hash', tx_hash.toLowerCase())
                .single();

            if (existing) {
                return res.status(409).json({ error: 'This transaction has already been recorded' });
            }

            // Verify on-chain
            const verification = await verifyClawnchTransfer(tx_hash);
            if (!verification.valid) {
                return res.status(400).json({ error: verification.reason });
            }

            // Look up contributor's profile for display name
            let xHandle = null;
            let xName = null;
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('x_handle, x_name')
                .eq('wallet_address', wallet_address.toLowerCase())
                .single();
            if (profile) {
                xHandle = profile.x_handle;
                xName = profile.x_name;
            }

            // Get current week end
            const { data: config } = await supabase
                .from('inclawbate_rewards')
                .select('week_ends_at')
                .eq('id', 1)
                .single();

            // Record contribution
            const { error: insertErr } = await supabase
                .from('inclawbate_pool_contributions')
                .insert({
                    wallet_address: wallet_address.toLowerCase(),
                    x_handle: xHandle,
                    x_name: xName,
                    tx_hash: tx_hash.toLowerCase(),
                    clawnch_amount: verification.amount,
                    week_ends_at: config?.week_ends_at || null
                });

            if (insertErr) {
                if (insertErr.code === '23505') {
                    return res.status(409).json({ error: 'This transaction has already been recorded' });
                }
                return res.status(500).json({ error: 'Failed to record contribution' });
            }

            // Increment current_pool
            const { data: curr } = await supabase
                .from('inclawbate_rewards')
                .select('current_pool')
                .eq('id', 1)
                .single();
            if (curr) {
                await supabase
                    .from('inclawbate_rewards')
                    .update({ current_pool: Number(curr.current_pool) + verification.amount })
                    .eq('id', 1);
            }

            return res.status(200).json({
                success: true,
                amount: verification.amount,
                contributor: xHandle || wallet_address.slice(0, 10) + '...'
            });
        }

        // Backwards compat: no action = admin config update
        if (!action) {
            const { wallet_address, current_pool, next_pool, last_distributed, total_distributed, week_ends_at, top_n } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== SUPER_ADMIN) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            const updates = { updated_at: new Date().toISOString() };
            if (current_pool !== undefined) updates.current_pool = current_pool;
            if (next_pool !== undefined) updates.next_pool = next_pool;
            if (last_distributed !== undefined) updates.last_distributed = last_distributed;
            if (total_distributed !== undefined) updates.total_distributed = total_distributed;
            if (week_ends_at !== undefined) updates.week_ends_at = week_ends_at;
            if (top_n !== undefined) updates.top_n = top_n;

            const { data, error } = await supabase
                .from('inclawbate_rewards')
                .update(updates)
                .eq('id', 1)
                .select('*')
                .single();

            if (error) return res.status(500).json({ error: 'Failed to update' });
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
