// Inclawbate — UBI Treasury Fund
// GET  — public, returns treasury stats + recent contributors
// POST {action:"fund", tx_hash, wallet_address} — anyone, deposit to UBI treasury

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const CLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
        // Get treasury config
        const { data: treasury } = await supabase
            .from('inclawbate_ubi_treasury')
            .select('*')
            .eq('id', 1)
            .single();

        // Get total humans with wallets (eligible pool)
        const { count: totalHumans } = await supabase
            .from('human_profiles')
            .select('id', { count: 'exact', head: true })
            .not('wallet_address', 'is', null);

        // Recent contributors
        let contributors = [];
        try {
            const { data: contribs } = await supabase
                .from('inclawbate_ubi_contributions')
                .select('wallet_address, x_handle, x_name, clawnch_amount, created_at')
                .order('created_at', { ascending: false })
                .limit(20);
            contributors = contribs || [];
        } catch (e) { /* table may not exist yet */ }

        const result = treasury || {
            total_balance: 0,
            total_distributed: 0,
            distribution_count: 0,
            verified_humans: 0,
            weekly_rate: 0,
            last_distribution_at: null
        };

        result.total_eligible = totalHumans || 0;
        result.contributors = contributors;

        return res.status(200).json(result);
    }

    if (req.method === 'POST') {
        const { action } = req.body;

        if (action === 'fund') {
            const { tx_hash, wallet_address } = req.body;

            if (!tx_hash || typeof tx_hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
                return res.status(400).json({ error: 'Valid tx_hash required' });
            }

            if (!wallet_address) {
                return res.status(400).json({ error: 'wallet_address required' });
            }

            // Check duplicate
            const { data: existing } = await supabase
                .from('inclawbate_ubi_contributions')
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

            // Look up contributor profile
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

            // Record contribution
            const { error: insertErr } = await supabase
                .from('inclawbate_ubi_contributions')
                .insert({
                    wallet_address: wallet_address.toLowerCase(),
                    x_handle: xHandle,
                    x_name: xName,
                    tx_hash: tx_hash.toLowerCase(),
                    clawnch_amount: verification.amount
                });

            if (insertErr) {
                if (insertErr.code === '23505') {
                    return res.status(409).json({ error: 'This transaction has already been recorded' });
                }
                return res.status(500).json({ error: 'Failed to record contribution' });
            }

            // Increment treasury balance
            const { data: curr } = await supabase
                .from('inclawbate_ubi_treasury')
                .select('total_balance')
                .eq('id', 1)
                .single();
            if (curr) {
                await supabase
                    .from('inclawbate_ubi_treasury')
                    .update({
                        total_balance: Number(curr.total_balance) + verification.amount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', 1);
            }

            return res.status(200).json({
                success: true,
                amount: verification.amount,
                contributor: xHandle || wallet_address.slice(0, 10) + '...'
            });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
