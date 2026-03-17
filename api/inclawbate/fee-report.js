// Fee Report — shows creator's pending WETH fees + per-token earnings estimate
// Discovers ALL tokens via Blockscout mints + DB projects (same as dashboard)
// GET ?wallet=0x... → { pending_weth, pending_usd, tokens: [...], total_daily_usd }

import { createClient } from '@supabase/supabase-js';

const CLANKER_FEE_LOCKER = '0xF3622742b1E446D92e45E22923Ef11C2fcD55D68';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const BASE_RPC = 'https://mainnet.base.org';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function pad32(addr) {
    return '000000000000000000000000' + addr.replace('0x', '').toLowerCase();
}

async function rpcCall(to, data) {
    try {
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 })
        });
        const result = await res.json();
        if (result.error || !result.result || result.result === '0x') return 0;
        return Number(BigInt(result.result)) / 1e18;
    } catch (e) { return 0; }
}

async function fetchEthPrice() {
    try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + WETH_BASE);
        const data = await res.json();
        const pair = (data.pairs || []).find(p => p.chainId === 'base');
        return pair ? parseFloat(pair.priceUsd) || 0 : 0;
    } catch (e) { return 0; }
}

async function fetchTokenVolume(tokenAddress) {
    try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + tokenAddress);
        const data = await res.json();
        const pair = (data.pairs || []).find(p => p.chainId === 'base');
        if (!pair) return { volume24h: 0, symbol: '???', name: 'Unknown', price: '0' };
        return {
            volume24h: pair.volume?.h24 || 0,
            symbol: pair.baseToken?.symbol || '???',
            name: pair.baseToken?.name || 'Unknown',
            price: pair.priceUsd || '0'
        };
    } catch (e) { return { volume24h: 0, symbol: '???', name: 'Unknown', price: '0' }; }
}

// Discover tokens from Blockscout mint history (same method as dashboard)
async function discoverTokensFromBlockscout(wallet) {
    const tokens = {}; // addr → { name, symbol }
    try {
        const resp = await fetch(
            'https://base.blockscout.com/api/v2/addresses/' + wallet +
            '/token-transfers?type=ERC-20&filter=to&limit=200'
        );
        if (!resp.ok) return tokens;
        const data = await resp.json();
        for (const item of (data.items || [])) {
            const from = (item.from?.hash || '').toLowerCase();
            const t = item.token || {};
            const addr = (t.address_hash || t.address || '').toLowerCase();
            // Mint events (from = 0x0) = tokens this wallet created
            if (from === '0x0000000000000000000000000000000000000000' && addr) {
                tokens[addr] = { name: t.name || 'Unknown', symbol: t.symbol || '???' };
            }
        }
    } catch (e) {}
    return tokens;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const wallet = (req.query.wallet || '').trim().toLowerCase();
    if (!wallet || !wallet.startsWith('0x')) {
        return res.status(400).json({ error: 'Missing or invalid wallet parameter' });
    }

    // 1. Query pending WETH + ETH price + DB projects + Blockscout discovery in parallel
    const feesToClaimData = '0x8417645e' + pad32(wallet) + pad32(WETH_BASE);
    const [pendingWeth, ethPrice, dbResult, blockscoutTokens] = await Promise.all([
        rpcCall(CLANKER_FEE_LOCKER, feesToClaimData),
        fetchEthPrice(),
        supabase.from('inclawbator_projects')
            .select('id, token_name, token_symbol, token_address, chain, fee_split_bps, total_fees_claimed, status')
            .ilike('creator_wallet', wallet)
            .eq('status', 'active'),
        discoverTokensFromBlockscout(wallet)
    ]);

    const pendingUsd = pendingWeth * ethPrice;
    const dbProjects = dbResult.data || [];

    // 2. Merge DB projects + Blockscout-discovered tokens (deduplicate by address)
    const allTokens = new Map(); // addr → { name, symbol, fee_split_bps, from_db }

    // DB projects first (they have fee_split_bps info)
    for (const p of dbProjects) {
        if ((p.chain || 'base') === 'base' && p.token_address) {
            allTokens.set(p.token_address.toLowerCase(), {
                name: p.token_name,
                symbol: p.token_symbol,
                fee_split_bps: p.fee_split_bps || 10000,
                total_claimed: p.total_fees_claimed || 0,
                from_db: true
            });
        }
    }

    // Blockscout-discovered tokens (only add if not already in DB)
    for (const [addr, info] of Object.entries(blockscoutTokens)) {
        if (!allTokens.has(addr)) {
            allTokens.set(addr, {
                name: info.name,
                symbol: info.symbol,
                fee_split_bps: 10000, // assume 100% if not in DB
                total_claimed: 0,
                from_db: false
            });
        }
    }

    // 3. Fetch DexScreener volumes for each token (max 10 to avoid rate limits)
    const entries = Array.from(allTokens.entries()).slice(0, 10);
    const tokenDetails = await Promise.all(
        entries.map(async ([addr, info]) => {
            const vol = await fetchTokenVolume(addr);
            const splitPct = (info.fee_split_bps || 10000) / 10000;
            const dailyFeeUsd = vol.volume24h * 0.01 * splitPct;
            const dailyFeeEth = ethPrice > 0 ? dailyFeeUsd / ethPrice : 0;
            return {
                token_name: info.name || vol.name,
                token_symbol: info.symbol || vol.symbol,
                token_address: addr,
                volume_24h: vol.volume24h,
                price: vol.price,
                fee_split_pct: Math.round(splitPct * 100),
                estimated_daily_eth: Math.round(dailyFeeEth * 1e8) / 1e8,
                estimated_daily_usd: Math.round(dailyFeeUsd * 100) / 100,
                total_claimed: info.total_claimed,
                registered: info.from_db
            };
        })
    );

    // Sort by volume descending
    tokenDetails.sort((a, b) => b.volume_24h - a.volume_24h);

    const totalDailyUsd = tokenDetails.reduce((s, t) => s + t.estimated_daily_usd, 0);
    const totalDailyEth = tokenDetails.reduce((s, t) => s + t.estimated_daily_eth, 0);

    return res.status(200).json({
        wallet,
        pending_weth: Math.round(pendingWeth * 1e8) / 1e8,
        pending_usd: Math.round(pendingUsd * 100) / 100,
        eth_price: Math.round(ethPrice * 100) / 100,
        tokens: tokenDetails,
        total_daily_eth: Math.round(totalDailyEth * 1e8) / 1e8,
        total_daily_usd: Math.round(totalDailyUsd * 100) / 100,
        total_projects: tokenDetails.length
    });
}
