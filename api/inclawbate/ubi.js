// Inclawbate — UBI Treasury Fund (Dual Staking: CLAWNCH 1x / inCLAWNCH 2x)
// GET  — public, returns treasury stats + recent contributors + staker-days
// GET  ?wallet=0x... — also returns user's active stakes
// GET  ?distribution=true — admin: full staker breakdown with weighted shares
// POST {action:"fund", tx_hash, wallet_address, token?} — deposit to UBI treasury
// POST {action:"unstake", wallet_address, token} — mark stakes inactive
// POST {action:"update-config", wallet_address, daily_rate|weekly_rate} — admin: set distribution rate

import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const TG_BOT_TOKEN = process.env.INCLAWBATE_TELEGRAM_BOT_TOKEN;
const TG_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

async function notifyAdmin(text) {
    if (!TG_BOT_TOKEN || !TG_ADMIN_CHAT_ID) return;
    try {
        await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_ADMIN_CHAT_ID, text, parse_mode: 'HTML' })
        });
    } catch (e) { /* silent */ }
}

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const CLAWNCH_ADDRESS = '0xa1f72459dfa10bad200ac160ecd78c6b77a747be';
const INCLAWNCH_ADDRESS = '0xb0b6e0e9da530f68d713cc03a813b506205ac808';
const PROTOCOL_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const UNSTAKE_WALLET = '0xa4d6f012003fe6ad2774a874c8c98ee69d17f286';
const DEPOSIT_WALLET = UNSTAKE_WALLET; // new stakes go to unstake wallet so it self-funds
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

    if (to !== DEPOSIT_WALLET && to !== PROTOCOL_WALLET) {
        return { valid: false, reason: 'Transfer was not sent to the deposit wallet' };
    }

    if (amount <= 0) {
        return { valid: false, reason: 'Transfer amount is zero' };
    }

    return { valid: true, amount, from };
}

// Calculate staker-days breakdown for all active stakers (proportional distribution)
async function calculateStakerDays(weeklyRate, walletCapPct) {
    const { data: activeStakes } = await supabase
        .from('inclawbate_ubi_contributions')
        .select('wallet_address, x_handle, x_name, clawnch_amount, token, created_at')
        .eq('active', true);

    if (!activeStakes || activeStakes.length === 0) {
        return { stakers: [], total_weighted_days: 0 };
    }

    // Exclude banned wallets
    const { data: bannedRows } = await supabase
        .from('human_profiles')
        .select('wallet_address')
        .eq('airdrop_banned', true)
        .not('wallet_address', 'is', null);
    const bannedWallets = new Set((bannedRows || []).map(r => r.wallet_address.toLowerCase()));
    const filteredStakes = activeStakes.filter(s => !bannedWallets.has(s.wallet_address.toLowerCase()));

    if (filteredStakes.length === 0) {
        return { stakers: [], total_weighted_days: 0 };
    }

    const now = Date.now();
    const walletMap = {};

    for (const stake of filteredStakes) {
        const wallet = stake.wallet_address;
        const token = stake.token || 'clawnch';
        const multiplier = token === 'inclawnch' ? 2 : 1;
        const days = Math.min(1, (now - new Date(stake.created_at).getTime()) / 86400000);
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

    // Look up auto_stake + redirect preferences for each staker
    const uniqueWalletsArr = [...new Set(stakers.map(s => s.wallet.toLowerCase()))];
    const { data: stakerProfiles } = await supabase
        .from('human_profiles')
        .select('wallet_address, ubi_auto_stake, ubi_whale_redirect_target, ubi_redirect_org_id, ubi_split_keep_pct, ubi_split_kingdom_pct, ubi_split_reinvest_pct')
        .in('wallet_address', uniqueWalletsArr);
    const profileMap = {};
    (stakerProfiles || []).forEach(p => {
        profileMap[p.wallet_address.toLowerCase()] = p;
    });

    var dailyRate = weeklyRate / 7;

    // Compute proportional shares + attach redirect preferences
    for (const s of stakers) {
        const prof = profileMap[s.wallet.toLowerCase()] || {};
        s.auto_stake = prof.ubi_auto_stake || false;
        s.redirect_target = prof.ubi_whale_redirect_target || null;
        s.redirect_org_id = prof.ubi_redirect_org_id || null;
        s.split_keep_pct = prof.ubi_split_keep_pct ?? null;
        s.split_kingdom_pct = prof.ubi_split_kingdom_pct ?? null;
        s.split_reinvest_pct = prof.ubi_split_reinvest_pct ?? null;
        s.share_pct = totalWeightedDays > 0 ? (s.weighted_days / totalWeightedDays) * 100 : 0;
        s.share_amount = totalWeightedDays > 0 && dailyRate > 0
            ? (s.weighted_days / totalWeightedDays) * dailyRate
            : 0;
    }

    // Round for display
    for (const s of stakers) {
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

        // Get all active stakes to compute real TVL + staker count
        const { data: activeStakes } = await supabase
            .from('inclawbate_ubi_contributions')
            .select('wallet_address, clawnch_amount, token')
            .eq('active', true);

        const uniqueWallets = new Set((activeStakes || []).map(r => r.wallet_address));
        const totalStakers = uniqueWallets.size;

        // Compute actual staked totals from active contributions
        let realClawnchStaked = 0;
        let realInclawnchStaked = 0;
        (activeStakes || []).forEach(s => {
            if (s.token === 'inclawnch') {
                realInclawnchStaked += s.clawnch_amount;
            } else {
                realClawnchStaked += s.clawnch_amount;
            }
        });

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
            last_distribution_at: null,
            reward_split_pct: 80
        };
        // Default split if not set in DB
        if (result.reward_split_pct === undefined || result.reward_split_pct === null) {
            result.reward_split_pct = 80;
        }

        // Override with real computed totals (treasury counters can drift)
        result.total_balance = realClawnchStaked;
        result.inclawnch_staked = realInclawnchStaked;
        result.total_stakers = totalStakers;
        result.contributors = contributors;
        // Compute daily_rate from weekly_rate for daily distribution schedule
        result.daily_rate = (Number(result.weekly_rate) || 0) / 7;
        // Deposit address — stakes go to the unstake wallet so it self-funds withdrawals
        result.deposit_address = DEPOSIT_WALLET;
        // Per-wallet cap percentage (default 10)
        if (result.wallet_cap_pct === undefined || result.wallet_cap_pct === null) {
            result.wallet_cap_pct = 10;
        }

        // If wallet query param, return user's active stakes + auto_stake preference
        const walletParam = req.query.wallet;
        if (walletParam) {
            const { data: myStakes } = await supabase
                .from('inclawbate_ubi_contributions')
                .select('id, wallet_address, clawnch_amount, token, created_at, active, unstaked_at, withdrawal_status')
                .eq('wallet_address', walletParam.toLowerCase())
                .order('created_at', { ascending: false });
            result.my_stakes = myStakes || [];

            // Include auto_stake + redirect preferences
            const { data: prof } = await supabase
                .from('human_profiles')
                .select('ubi_auto_stake, ubi_whale_redirect_target, ubi_redirect_org_id, ubi_redirect_request_id, ubi_split_keep_pct, ubi_split_kingdom_pct, ubi_split_reinvest_pct')
                .eq('wallet_address', walletParam.toLowerCase())
                .single();
            result.auto_stake = prof?.ubi_auto_stake || false;
            result.whale_redirect_target = prof?.ubi_whale_redirect_target || null;
            result.redirect_org_id = prof?.ubi_redirect_org_id || null;
            result.redirect_request_id = prof?.ubi_redirect_request_id || null;
            result.split_keep_pct = prof?.ubi_split_keep_pct ?? null;
            result.split_kingdom_pct = prof?.ubi_split_kingdom_pct ?? null;
            result.split_reinvest_pct = prof?.ubi_split_reinvest_pct ?? null;
        }

        // Fetch active philanthropy orgs
        try {
            const { data: orgs } = await supabase
                .from('inclawbate_philanthropy_orgs')
                .select('id, name, description, wallet_address, image_url, website_url')
                .eq('is_active', true)
                .order('id', { ascending: true });
            result.philanthropy_orgs = orgs || [];
        } catch (e) {
            result.philanthropy_orgs = [];
        }

        // If distribution=true (admin), return full staker breakdown
        if (req.query.distribution === 'true') {
            const weeklyRate = Number(result.weekly_rate) || 0;
            const capPct = Number(result.wallet_cap_pct) || 10;
            const { stakers, total_weighted_days } = await calculateStakerDays(weeklyRate, capPct);
            result.distribution = {
                stakers,
                total_weighted_days,
                weekly_rate: weeklyRate
            };

            // Also include pending unstakes (recently unstaked, for return)
            // Try filtering out already-returned ones first
            let unstaked = [];
            try {
                const { data: u1, error: u1Err } = await supabase
                    .from('inclawbate_ubi_contributions')
                    .select('id, wallet_address, x_handle, x_name, clawnch_amount, token, unstaked_at, withdrawal_status')
                    .eq('active', false)
                    .not('unstaked_at', 'is', null)
                    .or('withdrawal_status.is.null,withdrawal_status.neq.completed')
                    .order('unstaked_at', { ascending: false })
                    .limit(50);
                if (u1Err) throw u1Err;
                unstaked = u1 || [];
            } catch (e) {
                // withdrawal_status column may not exist — fall back to unfiltered
                const { data: u2 } = await supabase
                    .from('inclawbate_ubi_contributions')
                    .select('id, wallet_address, x_handle, x_name, clawnch_amount, token, unstaked_at')
                    .eq('active', false)
                    .not('unstaked_at', 'is', null)
                    .order('unstaked_at', { ascending: false })
                    .limit(50);
                unstaked = u2 || [];
            }
            result.distribution.pending_unstakes = unstaked;
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

        // ── Unstake (instant via unstake wallet, or request if insufficient) ──
        if (action === 'unstake') {
            const { wallet_address, token } = req.body;
            if (!wallet_address) {
                return res.status(400).json({ error: 'wallet_address required' });
            }
            if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
                return res.status(400).json({ error: 'Invalid wallet address' });
            }
            const tokenType = (token === 'inclawnch') ? 'inclawnch' : 'clawnch';
            const tokenAddress = TOKEN_ADDRESSES[tokenType];

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

            // Try instant return via unstake wallet
            const unstakeKey = process.env.UNSTAKE_WALLET_PRIVATE_KEY;
            let txHash = null;
            let instant = false;

            if (unstakeKey) {
                try {
                    const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
                    const unstakeWallet = new ethers.Wallet(unstakeKey, provider);

                    const erc20 = new ethers.Contract(tokenAddress, [
                        'function transfer(address to, uint256 amount) returns (bool)',
                        'function balanceOf(address) view returns (uint256)'
                    ], unstakeWallet);

                    const amountWei = ethers.parseUnits(Math.floor(totalUnstaked).toString(), 18);
                    const balance = await erc20.balanceOf(unstakeWallet.address);

                    if (balance >= amountWei) {
                        // Enough balance — send instantly
                        const tx = await erc20.transfer(wallet_address, amountWei);
                        const receipt = await tx.wait();

                        if (receipt && receipt.status === 1) {
                            txHash = receipt.hash;
                            instant = true;
                        }
                    }
                } catch (chainErr) {
                    console.error('Unstake on-chain error:', chainErr.message);
                    const tokenLabel = tokenType === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
                    notifyAdmin(
                        `⚠️ <b>Unstake Chain Error</b>\n\n` +
                        `Wallet: <code>${wallet_address}</code>\n` +
                        `Amount: ${Math.floor(totalUnstaked).toLocaleString()} ${tokenLabel}\n` +
                        `Error: ${chainErr.message?.slice(0, 200)}`
                    );
                    // Fall through to withdrawal request
                }
            }

            // Mark stakes as inactive — try with withdrawal columns, fall back without
            let updateErr;
            const fullUpdate = {
                active: false,
                unstaked_at: new Date().toISOString(),
                withdrawal_status: instant ? 'completed' : 'requested',
                withdrawal_tx: txHash
            };
            const minUpdate = {
                active: false,
                unstaked_at: new Date().toISOString()
            };

            const result1 = await supabase
                .from('inclawbate_ubi_contributions')
                .update(fullUpdate)
                .in('id', ids);

            if (result1.error) {
                // Columns might not exist — retry without them
                const result2 = await supabase
                    .from('inclawbate_ubi_contributions')
                    .update(minUpdate)
                    .in('id', ids);
                updateErr = result2.error;
            } else {
                updateErr = null;
            }

            if (updateErr) {
                if (instant) {
                    console.error('DB update failed after successful unstake tx:', txHash, 'ids:', ids);
                } else {
                    return res.status(500).json({ error: 'Failed to process unstake' });
                }
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

            // Notify admin
            const tokenLabel = tokenType === 'inclawnch' ? 'inCLAWNCH' : 'CLAWNCH';
            if (instant) {
                notifyAdmin(
                    `✅ <b>Unstake Sent</b>\n\n` +
                    `Wallet: <code>${wallet_address}</code>\n` +
                    `Amount: ${Math.floor(totalUnstaked).toLocaleString()} ${tokenLabel}\n` +
                    `Tx: <a href="https://basescan.org/tx/${txHash}">View</a>`
                );
            } else {
                notifyAdmin(
                    `🦞 <b>Withdrawal Request</b>\n\n` +
                    `Wallet: <code>${wallet_address}</code>\n` +
                    `Amount: ${Math.floor(totalUnstaked).toLocaleString()} ${tokenLabel}\n\n` +
                    `The unstake wallet needs to be topped up.`
                );
            }

            return res.status(200).json({
                success: true,
                instant: instant,
                amount: totalUnstaked,
                token: tokenType,
                tx_hash: txHash
            });
        }

        // ── Check unstake wallet balance (public) ──
        if (action === 'unstake-balance') {
            const unstakeKey = process.env.UNSTAKE_WALLET_PRIVATE_KEY;
            if (!unstakeKey) {
                return res.status(200).json({ clawnch: 0, inclawnch: 0, address: null });
            }
            try {
                const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
                const unstakeWallet = new ethers.Wallet(unstakeKey, provider);
                const abi = ['function balanceOf(address) view returns (uint256)'];
                const clawnchContract = new ethers.Contract(CLAWNCH_ADDRESS, abi, provider);
                const inclawnchContract = new ethers.Contract(INCLAWNCH_ADDRESS, abi, provider);

                const [clBal, inBal] = await Promise.all([
                    clawnchContract.balanceOf(unstakeWallet.address),
                    inclawnchContract.balanceOf(unstakeWallet.address)
                ]);

                return res.status(200).json({
                    clawnch: Number(clBal) / 1e18,
                    inclawnch: Number(inBal) / 1e18,
                    address: unstakeWallet.address
                });
            } catch (e) {
                return res.status(200).json({ clawnch: 0, inclawnch: 0, address: null });
            }
        }

        // ── Update Config (admin only) ──
        if (action === 'update-config') {
            const { wallet_address, weekly_rate, daily_rate, reward_split_pct } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            const updateObj = { updated_at: new Date().toISOString() };

            if (daily_rate !== undefined) {
                // Accept daily_rate and store as weekly_rate * 7
                if (isNaN(Number(daily_rate)) || Number(daily_rate) < 0) {
                    return res.status(400).json({ error: 'Valid daily_rate required' });
                }
                updateObj.weekly_rate = Number(daily_rate) * 7;
            } else if (weekly_rate !== undefined) {
                if (isNaN(Number(weekly_rate)) || Number(weekly_rate) < 0) {
                    return res.status(400).json({ error: 'Valid weekly_rate required' });
                }
                updateObj.weekly_rate = Number(weekly_rate);
            }

            if (reward_split_pct !== undefined) {
                const pct = Number(reward_split_pct);
                if (isNaN(pct) || pct < 0 || pct > 100) {
                    return res.status(400).json({ error: 'reward_split_pct must be 0-100' });
                }
                updateObj.reward_split_pct = pct;
            }

            if (req.body.wallet_cap_pct !== undefined) {
                const cap = Number(req.body.wallet_cap_pct);
                if (isNaN(cap) || cap < 1 || cap > 100) {
                    return res.status(400).json({ error: 'wallet_cap_pct must be 1-100' });
                }
                updateObj.wallet_cap_pct = cap;
            }

            if (req.body.total_distributed !== undefined) {
                const td = Number(req.body.total_distributed);
                if (!isNaN(td) && td >= 0) updateObj.total_distributed = td;
            }

            if (Object.keys(updateObj).length <= 1) {
                return res.status(400).json({ error: 'Provide weekly_rate, daily_rate, reward_split_pct, wallet_cap_pct, or total_distributed' });
            }

            const { error: updateErr } = await supabase
                .from('inclawbate_ubi_treasury')
                .update(updateObj)
                .eq('id', 1);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to update config' });
            }

            return res.status(200).json({
                success: true,
                weekly_rate: updateObj.weekly_rate,
                daily_rate: updateObj.weekly_rate ? updateObj.weekly_rate / 7 : undefined,
                reward_split_pct: updateObj.reward_split_pct,
                wallet_cap_pct: updateObj.wallet_cap_pct
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
                .select('distribution_count, total_distributed, weekly_rate')
                .eq('id', 1)
                .single();

            const dailyAmount = Math.round((Number(curr?.weekly_rate) || 0) / 7);
            const newTotal = (Number(curr?.total_distributed) || 0) + dailyAmount;

            const { error: updateErr } = await supabase
                .from('inclawbate_ubi_treasury')
                .update({
                    last_distribution_at: new Date().toISOString(),
                    distribution_count: (Number(curr?.distribution_count) || 0) + 1,
                    total_distributed: newTotal,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to record distribution' });
            }

            // Increment ubi_total_received per wallet
            const recipients = req.body.recipients; // [{wallet, amount}]
            if (Array.isArray(recipients) && recipients.length > 0) {
                for (const r of recipients) {
                    if (!r.wallet || !r.amount) continue;
                    const { data: profile } = await supabase
                        .from('human_profiles')
                        .select('ubi_total_received')
                        .eq('wallet_address', r.wallet.toLowerCase())
                        .single();
                    if (profile) {
                        await supabase
                            .from('human_profiles')
                            .update({ ubi_total_received: (Number(profile.ubi_total_received) || 0) + Number(r.amount) })
                            .eq('wallet_address', r.wallet.toLowerCase());
                    }
                }
            }

            return res.status(200).json({
                success: true,
                distribution_count: (Number(curr?.distribution_count) || 0) + 1,
                total_distributed: newTotal
            });
        }

        // ── Mark Unstakes as Returned (admin only) ──
        if (action === 'mark-returned') {
            const { wallet_address, returns, tx_hash } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            // returns = [{wallet, token}] — mark all matching pending unstakes as completed
            if (!Array.isArray(returns) || returns.length === 0) {
                return res.status(400).json({ error: 'returns array required' });
            }

            let marked = 0;
            for (const r of returns) {
                // Try with withdrawal_status column first
                try {
                    const { data: rows } = await supabase
                        .from('inclawbate_ubi_contributions')
                        .select('id')
                        .eq('wallet_address', r.wallet.toLowerCase())
                        .eq('token', r.token)
                        .eq('active', false)
                        .not('unstaked_at', 'is', null);

                    if (rows && rows.length > 0) {
                        const ids = rows.map(row => row.id);
                        await supabase
                            .from('inclawbate_ubi_contributions')
                            .update({
                                withdrawal_status: 'completed',
                                withdrawal_tx: tx_hash || null
                            })
                            .in('id', ids);
                        marked += ids.length;
                    }
                } catch (e) {
                    // Column may not exist — skip gracefully
                    console.error('mark-returned error for', r.wallet, r.token, e.message);
                }
            }

            return res.status(200).json({ success: true, marked });
        }

        // ── Toggle Auto-Stake Preference ──
        if (action === 'toggle-auto-stake') {
            const { wallet_address } = req.body;
            if (!wallet_address) {
                return res.status(400).json({ error: 'wallet_address required' });
            }

            const wallet = wallet_address.toLowerCase();
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('ubi_auto_stake')
                .eq('wallet_address', wallet)
                .single();

            if (!profile) {
                return res.status(404).json({ error: 'Profile not found' });
            }

            const newVal = !profile.ubi_auto_stake;
            const { error: updateErr } = await supabase
                .from('human_profiles')
                .update({ ubi_auto_stake: newVal })
                .eq('wallet_address', wallet);

            if (updateErr) {
                return res.status(500).json({ error: 'Failed to update auto-stake preference' });
            }

            return res.status(200).json({ success: true, auto_stake: newVal });
        }

        // ── Record Auto-Stakes (admin only) ──
        if (action === 'record-auto-stakes') {
            const { wallet_address, recipients, distribution_count } = req.body;
            if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!Array.isArray(recipients) || recipients.length === 0) {
                return res.status(400).json({ error: 'recipients array required' });
            }

            let recorded = 0;
            for (const r of recipients) {
                if (!r.wallet || !r.amount || r.amount <= 0) continue;
                const wallet = r.wallet.toLowerCase();
                const token = r.token || 'clawnch';
                const distNum = distribution_count || 0;
                const syntheticTx = `auto-ubi-${distNum}-${wallet.slice(0, 8)}`;

                // Look up profile for x_handle/x_name
                let xHandle = null;
                let xName = null;
                const { data: prof } = await supabase
                    .from('human_profiles')
                    .select('x_handle, x_name')
                    .eq('wallet_address', wallet)
                    .single();
                if (prof) {
                    xHandle = prof.x_handle;
                    xName = prof.x_name;
                }

                // Insert contribution record (auto-staked UBI)
                await supabase
                    .from('inclawbate_ubi_contributions')
                    .insert({
                        wallet_address: wallet,
                        x_handle: xHandle,
                        x_name: xName,
                        tx_hash: syntheticTx,
                        clawnch_amount: r.amount,
                        token: token,
                        active: true
                    });

                // Increment treasury balance
                const balanceColumn = token === 'inclawnch' ? 'inclawnch_staked' : 'total_balance';
                const { data: curr } = await supabase
                    .from('inclawbate_ubi_treasury')
                    .select('total_balance, inclawnch_staked')
                    .eq('id', 1)
                    .single();
                if (curr) {
                    const updateObj = { updated_at: new Date().toISOString() };
                    updateObj[balanceColumn] = Number(curr[balanceColumn] || 0) + r.amount;
                    await supabase
                        .from('inclawbate_ubi_treasury')
                        .update(updateObj)
                        .eq('id', 1);
                }

                recorded++;
            }

            return res.status(200).json({ success: true, recorded });
        }

        // ── Update Give Back / Redirect Preference (any staker) ──
        if (action === 'update-whale-redirect') {
            const { wallet_address, redirect_target, org_id, split_keep_pct, split_kingdom_pct, split_reinvest_pct } = req.body;
            if (!wallet_address) {
                return res.status(400).json({ error: 'wallet_address required' });
            }

            const wallet = wallet_address.toLowerCase();

            // Validate redirect_target: null (keep), 'philanthropy', 'reinvest', or 'split'
            const validTargets = [null, 'philanthropy', 'reinvest', 'split'];
            if (!validTargets.includes(redirect_target)) {
                return res.status(400).json({ error: 'redirect_target must be null, philanthropy, reinvest, or split' });
            }

            // Validate split percentages if target is 'split'
            if (redirect_target === 'split') {
                const k = Number(split_keep_pct) || 0;
                const g = Number(split_kingdom_pct) || 0;
                const r = Number(split_reinvest_pct) || 0;
                if (k < 0 || g < 0 || r < 0 || k + g + r !== 100) {
                    return res.status(400).json({ error: 'Split percentages must be non-negative and sum to 100' });
                }
            }

            // Default org_id to 1 (E3 Ministry) when kingdom allocation > 0
            let resolvedOrgId = null;
            if (redirect_target === 'philanthropy' || redirect_target === 'split') {
                const kingdomPct = Number(split_kingdom_pct) || 0;
                if (org_id) {
                    resolvedOrgId = Number(org_id);
                } else if (redirect_target === 'philanthropy' || kingdomPct > 0) {
                    resolvedOrgId = 1; // E3 Ministry default
                }
            }

            const updateFields = {
                ubi_whale_redirect_target: redirect_target,
                ubi_redirect_org_id: resolvedOrgId,
                ubi_split_keep_pct: redirect_target === 'split' ? Number(split_keep_pct) || 0 : null,
                ubi_split_kingdom_pct: redirect_target === 'split' ? Number(split_kingdom_pct) || 0 : null,
                ubi_split_reinvest_pct: redirect_target === 'split' ? Number(split_reinvest_pct) || 0 : null
            };

            const { error: updateErr } = await supabase
                .from('human_profiles')
                .upsert({ wallet_address: wallet, ...updateFields }, { onConflict: 'wallet_address' });

            if (updateErr) {
                console.error('Redirect upsert error:', updateErr);
                return res.status(500).json({ error: 'Failed to update redirect preference', detail: updateErr.message });
            }

            return res.status(200).json({
                success: true,
                redirect_target: redirect_target,
                org_id: updateFields.ubi_redirect_org_id,
                split_keep_pct: updateFields.ubi_split_keep_pct,
                split_kingdom_pct: updateFields.ubi_split_kingdom_pct,
                split_reinvest_pct: updateFields.ubi_split_reinvest_pct
            });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
