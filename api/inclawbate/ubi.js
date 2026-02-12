// Inclawbate — UBI Treasury Fund (Dual Staking: CLAWNCH 1x / inCLAWNCH 2x)
// GET  — public, returns treasury stats + recent contributors + staker-days
// GET  ?wallet=0x... — also returns user's active stakes
// GET  ?distribution=true — admin: full staker breakdown with weighted shares
// POST {action:"fund", tx_hash, wallet_address, token?} — deposit to UBI treasury
// POST {action:"unstake", wallet_address, token} — mark stakes inactive
// POST {action:"update-config", wallet_address, weekly_rate} — admin: set weekly rate

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const CLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const INCLAWNCH_ADDRESS = '0xb0b6e0e9da530f68d713cc03a813b506205ac808';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const ADMIN_WALLET = PROTOCOL_WALLET;
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const TOKEN_ADDRESSES = {
    clawnch: CLAWNCH_ADDRESS,
    inclawnch: INCLAWNCH_ADDRESS
};

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

async function verifyTokenTransfer(txHash, tokenAddress) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Transaction failed or not found' };
    }

    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === tokenAddress.toLowerCase() &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No matching token transfer found in transaction' };
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

// Calculate staker-days breakdown for all active stakers
async function calculateStakerDays(weeklyRate) {
    const { data: activeStakes } = await supabase
        .from('inclawbate_ubi_contributions')
        .select('wallet_address, x_handle, x_name, clawnch_amount, token, created_at')
        .eq('active', true);

    if (!activeStakes || activeStakes.length === 0) {
        return { stakers: [], total_weighted_days: 0 };
    }

    const now = Date.now();
    const walletMap = {};

    for (const stake of activeStakes) {
        const wallet = stake.wallet_address;
        const token = stake.token || 'clawnch';
        const multiplier = token === 'inclawnch' ? 2 : 1;
        const days = Math.min(7, (now - new Date(stake.created_at).getTime()) / 86400000);
        const weight = stake.clawnch_amount * multiplier * days;

        const key = wallet + '_' + token;
        if (!walletMap[key]) {
            walletMap[key] = {
                wallet: wallet,
                x_handle: stake.x_handle,
                x_name: stake.x_name,
                token: token,
                amount: 0,
                multiplier: multiplier,
                staked_days: days,
                weighted_days: 0
            };
        }
        walletMap[key].amount += stake.clawnch_amount;
        walletMap[key].weighted_days += weight;
        // Use the longest staking time for display
        if (days > walletMap[key].staked_days) {
            walletMap[key].staked_days = days;
        }
    }

    const stakers = Object.values(walletMap);
    const totalWeightedDays = stakers.reduce((sum, s) => sum + s.weighted_days, 0);

    for (const s of stakers) {
        s.share_pct = totalWeightedDays > 0 ? (s.weighted_days / totalWeightedDays) * 100 : 0;
        s.share_amount = totalWeightedDays > 0 && weeklyRate > 0
            ? (s.weighted_days / totalWeightedDays) * weeklyRate
            : 0;
        // Round for display
        s.staked_days = Math.round(s.staked_days * 10) / 10;
        s.weighted_days = Math.round(s.weighted_days * 100) / 100;
        s.share_pct = Math.round(s.share_pct * 100) / 100;
        s.share_amount = Math.round(s.share_amount * 100) / 100;
    }

    // Sort by share descending
    stakers.sort((a, b) => b.share_pct - a.share_pct);

    return { stakers, total_weighted_days: totalWeightedDays };
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

        // Get total active stakers (unique wallets)
        const { data: activeWallets } = await supabase
            .from('inclawbate_ubi_contributions')
            .select('wallet_address')
            .eq('active', true);

        const uniqueWallets = new Set((activeWallets || []).map(r => r.wallet_address));
        const totalStakers = uniqueWallets.size;

        // Recent contributors (active only)
        let contributors = [];
        try {
            const { data: contribs } = await supabase
                .from('inclawbate_ubi_contributions')
                .select('wallet_address, x_handle, x_name, clawnch_amount, token, created_at, active')
                .order('created_at', { ascending: false })
                .limit(20);
            contributors = contribs || [];
        } catch (e) { /* table may not exist yet */ }

        const result = treasury || {
            total_balance: 0,
            inclawnch_staked: 0,
            total_distributed: 0,
            distribution_count: 0,
            verified_humans: 0,
            weekly_rate: 0,
            last_distribution_at: null
        };

        result.total_stakers = totalStakers;
        result.contributors = contributors;

        // If wallet query param, return user's active stakes
        const walletParam = req.query.wallet;
        if (walletParam) {
            const { data: myStakes } = await supabase
                .from('inclawbate_ubi_contributions')
                .select('id, wallet_address, clawnch_amount, token, created_at, active, unstaked_at')
                .eq('wallet_address', walletParam.toLowerCase())
                .order('created_at', { ascending: false });
            result.my_stakes = myStakes || [];
        }

        // If distribution=true (admin), return full staker breakdown
        if (req.query.distribution === 'true') {
            const weeklyRate = Number(result.weekly_rate) || 0;
            const { stakers, total_weighted_days } = await calculateStakerDays(weeklyRate);
            result.distribution = {
                stakers,
                total_weighted_days,
                weekly_rate: weeklyRate
            };

            // Also include pending unstakes (recently unstaked, for return)
            const { data: unstaked } = await supabase
                .from('inclawbate_ubi_contributions')
                .select('wallet_address, x_handle, x_name, clawnch_amount, token, unstaked_at')
                .eq('active', false)
                .not('unstaked_at', 'is', null)
                .order('unstaked_at', { ascending: false })
                .limit(50);
            result.distribution.pending_unstakes = unstaked || [];
        }

        return res.status(200).json(result);
    }

    if (req.method === 'POST') {
        const { action } = req.body;

        if (action === 'fund') {
            const { tx_hash, wallet_address, token } = req.body;
            const tokenType = (token === 'inclawnch') ? 'inclawnch' : 'clawnch';
            const tokenAddress = TOKEN_ADDRESSES[tokenType];

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
            const verification = await verifyTokenTransfer(tx_hash, tokenAddress);
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
                    clawnch_amount: verification.amount,
                    token: tokenType,
                    active: true
                });

            if (insertErr) {
                if (insertErr.code === '23505') {
                    return res.status(409).json({ error: 'This transaction has already been recorded' });
                }
                return res.status(500).json({ error: 'Failed to record contribution' });
            }

            // Increment correct treasury column
            const balanceColumn = tokenType === 'inclawnch' ? 'inclawnch_staked' : 'total_balance';
            const { data: curr } = await supabase
                .from('inclawbate_ubi_treasury')
                .select('total_balance, inclawnch_staked')
                .eq('id', 1)
                .single();
            if (curr) {
                const updateObj = { updated_at: new Date().toISOString() };
                updateObj[balanceColumn] = Number(curr[balanceColumn] || 0) + verification.amount;
                await supabase
                    .from('inclawbate_ubi_treasury')
                    .update(updateObj)
                    .eq('id', 1);
            }

            return res.status(200).json({
                success: true,
                amount: verification.amount,
                token: tokenType,
                contributor: xHandle || wallet_address.slice(0, 10) + '...'
            });
        }

        // ── Unstake ──
        if (action === 'unstake') {
            const { wallet_address, token } = req.body;
            if (!wallet_address) {
                return res.status(400).json({ error: 'wallet_address required' });
            }
            const tokenType = (token === 'inclawnch') ? 'inclawnch' : 'clawnch';

            // Get total amount being unstaked
            const { data: activeStakes } = await supabase
                .from('inclawbate_ubi_contributions')
                .select('id, clawnch_amount')
                .eq('wallet_address', wallet_address.toLowerCase())
                .eq('token', tokenType)
                .eq('active', true);

            if (!activeStakes || activeStakes.length === 0) {
                return res.status(400).json({ error: 'No active stakes found for this token' });
            }

            const totalUnstaked = activeStakes.reduce((sum, s) => sum + s.clawnch_amount, 0);
            const ids = activeStakes.map(s => s.id);

            // Mark all as inactive
            const { error: updateErr } = await supabase
                .from('inclawbate_ubi_contributions')
                .update({ active: false, unstaked_at: new Date().toISOString() })
                .in('id', ids);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to unstake' });
            }

            // Decrement treasury balance
            const balanceColumn = tokenType === 'inclawnch' ? 'inclawnch_staked' : 'total_balance';
            const { data: curr } = await supabase
                .from('inclawbate_ubi_treasury')
                .select('total_balance, inclawnch_staked')
                .eq('id', 1)
                .single();
            if (curr) {
                const updateObj = { updated_at: new Date().toISOString() };
                updateObj[balanceColumn] = Math.max(0, Number(curr[balanceColumn] || 0) - totalUnstaked);
                await supabase
                    .from('inclawbate_ubi_treasury')
                    .update(updateObj)
                    .eq('id', 1);
            }

            return res.status(200).json({
                success: true,
                amount: totalUnstaked,
                token: tokenType
            });
        }

        // ── Update Config (admin only) ──
        if (action === 'update-config') {
            const { wallet_address, weekly_rate } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            if (weekly_rate === undefined || isNaN(Number(weekly_rate)) || Number(weekly_rate) < 0) {
                return res.status(400).json({ error: 'Valid weekly_rate required' });
            }

            const { error: updateErr } = await supabase
                .from('inclawbate_ubi_treasury')
                .update({
                    weekly_rate: Number(weekly_rate),
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to update config' });
            }

            return res.status(200).json({
                success: true,
                weekly_rate: Number(weekly_rate)
            });
        }

        // ── Mark Distribution Complete (admin only) ──
        if (action === 'mark-distributed') {
            const { wallet_address } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const { data: curr } = await supabase
                .from('inclawbate_ubi_treasury')
                .select('distribution_count')
                .eq('id', 1)
                .single();

            const { error: updateErr } = await supabase
                .from('inclawbate_ubi_treasury')
                .update({
                    last_distribution_at: new Date().toISOString(),
                    distribution_count: (Number(curr?.distribution_count) || 0) + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to record distribution' });
            }

            return res.status(200).json({
                success: true,
                distribution_count: (Number(curr?.distribution_count) || 0) + 1
            });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
