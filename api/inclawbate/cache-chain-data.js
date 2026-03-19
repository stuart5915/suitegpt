// Cache on-chain data to Supabase — runs on cron every 4 hours
// Reads staking, angel, treasury, staker count with generous delays
// /daily then reads from cache instead of hitting RPCs directly

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_RPCS = ['https://mainnet.base.org', 'https://base.drpc.org', 'https://base.llamarpc.com'];
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_CONTRACT = '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40';
const ANGEL_REWARDS_CONTRACT = '0x071aaa3A83CC0ffBf471907c6A0995f12E7C682B';
const LP_POOL = '0xAc89E3dc50Cb062C9B6f9e7F4f41e5Eb103a203F';
const TREASURY_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const TREASURY_WALLET_RAW = '91B5C0D07859CFeAfEB67d9694121CD741F049bd';
const TOTAL_SUPPLY = 100e9;

const delay = (ms) => new Promise(r => setTimeout(r, ms));

// Try multiple RPCs with fallback
async function rpcCall(method, params) {
    for (const rpc of BASE_RPCS) {
        try {
            const res = await fetch(rpc, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
            });
            const data = await res.json();
            if (data.error) continue;
            return data.result;
        } catch (e) { continue; }
    }
    return null;
}

async function ethCall(to, data) {
    const result = await rpcCall('eth_call', [{ to, data }, 'latest']);
    if (!result) return 0;
    return Number(BigInt(result));
}

function balanceOfData(addr) {
    return '0x70a08231000000000000000000000000' + addr.replace('0x', '').toLowerCase();
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const errors = [];

        // ── Staking reads (fully sequential to avoid rate limits) ──
        const contractTotalVal = await ethCall(CLAWS_ADDRESS, balanceOfData(STAKING_CONTRACT)) / 1e18;
        await delay(500);

        const storageRes = await rpcCall('eth_getStorageAt', [STAKING_CONTRACT, '0x6', 'latest']);
        const userStaked = storageRes ? Number(BigInt(storageRes)) / 1e18 : 0;
        await delay(500);

        const inLPVal = await ethCall(CLAWS_ADDRESS, balanceOfData(LP_POOL)) / 1e18;
        await delay(500);

        const rewardRateVal = await ethCall(STAKING_CONTRACT, '0x7b0a47ee') / 1e18; // rewardRate()
        await delay(500);

        const stakerCountVal = await ethCall(STAKING_CONTRACT, '0xdff69787'); // stakerCount() — raw uint
        await delay(500);

        const rewardsPool = contractTotalVal - userStaked;
        const dailyRewards = rewardRateVal * 86400;
        const apy = userStaked > 0 ? (dailyRewards * 365 / userStaked * 100) : 0;

        const staking = {
            staked: userStaked,
            rewardsPool: rewardsPool > 0 ? rewardsPool : 0,
            inLP: inLPVal,
            dailyRewards,
            apy,
            stakedPct: (userStaked / TOTAL_SUPPLY * 100).toFixed(1),
            lpPct: (inLPVal / TOTAL_SUPPLY * 100).toFixed(1),
            lockedPct: ((contractTotalVal + inLPVal) / TOTAL_SUPPLY * 100).toFixed(1),
            stakerCount: stakerCountVal
        };

        // ── Angel NFT reads (fully sequential to avoid rate limits) ──
        await delay(1000);

        const arRate = await ethCall(ANGEL_REWARDS_CONTRACT, '0x7b0a47ee') / 1e18;
        await delay(500);
        const arDeposited = await ethCall(ANGEL_REWARDS_CONTRACT, '0x1f4c74fd') / 1e18;
        await delay(500);
        const arClaimed = await ethCall(ANGEL_REWARDS_CONTRACT, '0xa34b0f76') / 1e18;
        await delay(500);
        const arHolders = await ethCall(ANGEL_REWARDS_CONTRACT, '0x362f04c0'); // raw uint
        await delay(500);
        const arRemaining = await ethCall(ANGEL_REWARDS_CONTRACT, '0x7a5c08ae') / 1e18;

        const angel = {
            dailyRewards: arRate * 86400,
            totalDeposited: arDeposited,
            totalClaimed: arClaimed,
            holders: arHolders,
            rewardsRemaining: arRemaining
        };

        // ── Treasury reads (fully sequential) ──
        await delay(1000);

        const wClaws = await ethCall(CLAWS_ADDRESS, balanceOfData(TREASURY_WALLET_RAW)) / 1e18;
        await delay(500);
        const sClaws = await ethCall(STAKING_CONTRACT, balanceOfData(TREASURY_WALLET_RAW)) / 1e18;
        await delay(500);
        const earnedCalldata = '0x008cc262000000000000000000000000' + TREASURY_WALLET_RAW.toLowerCase();
        const uClaws = await ethCall(STAKING_CONTRACT, earnedCalldata) / 1e18;
        await delay(500);

        // ETH balance
        const ethBalResult = await rpcCall('eth_getBalance', [TREASURY_WALLET, 'latest']);
        const ethBalance = ethBalResult ? Number(BigInt(ethBalResult)) / 1e18 : 0;

        // ETH price from DexScreener (not RPC)
        let ethPrice = 0;
        try {
            const ethRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006');
            const ethData = await ethRes.json();
            const topPair = ethData.pairs?.find(p => p.chainId === 'base' && p.quoteToken?.symbol === 'USDbC') || ethData.pairs?.[0];
            ethPrice = topPair ? parseFloat(topPair.priceUsd || 0) : 0;
        } catch (e) { /* unavailable */ }

        const totalClaws = wClaws + sClaws + uClaws;

        const treasury = {
            ethBalance,
            ethPrice,
            walletClaws: wClaws,
            stakedClaws: sClaws,
            unclaimedClaws: uClaws,
            totalClaws,
        };

        // ── Save to platform_settings ──
        const cache = {
            staking,
            angel,
            treasury,
            updated_at: new Date().toISOString()
        };

        const { error: saveErr } = await supabase.from('platform_settings').upsert(
            { key: 'chain_data_cache', value: JSON.stringify(cache), updated_at: new Date().toISOString() },
            { onConflict: 'key' }
        );

        if (saveErr) errors.push('Save error: ' + saveErr.message);

        return res.status(200).json({ ok: true, cache, errors: errors.length ? errors : undefined });

    } catch (err) {
        console.error('Cache chain data error:', err);
        return res.status(500).json({ error: err.message });
    }
}
