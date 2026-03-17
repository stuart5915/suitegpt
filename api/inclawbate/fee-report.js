// Fee Report — shows creator's pending WETH fees + per-token earnings estimate
// Discovers tokens via DB projects + Basescan token creation + known ecosystem list
// GET ?wallet=0x... → { pending_weth, pending_usd, tokens: [...], total_daily_usd }

import { createClient } from '@supabase/supabase-js';

const CLANKER_FEE_LOCKER = '0xF3622742b1E446D92e45E22923Ef11C2fcD55D68';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const BASE_RPC = 'https://mainnet.base.org';
const BASESCAN_KEY = 'C6WMY6JWVYDGI9QZBEDNUH86E7A5PIZACC';

// Known ecosystem tokens for the admin/platform wallet
// These are always included for inclawbate.base.eth (0x91B5C0D07859CFeAfEB67d9694121CD741F049bd)
const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
const KNOWN_TOKENS = [
    { addr: '0x7ca47b141639b893c6782823c0b219f872056379', name: 'CLAWS', symbol: 'CLAWS', fee_bps: 10000, platform: 'clanker' },
    { addr: '0x623a5cfc2e2e04957373a9f45b2b2beeabf82b07', name: 'PokerAI', symbol: 'POKERAI', fee_bps: 7500, platform: 'clanker' },
    { addr: '0xb0b6e0e9da530f68d713cc03a813b506205ac808', name: 'inCLAWNCH', symbol: 'INCLAWNCH', fee_bps: 10000, platform: 'clanker' },
    { addr: '0x9f15f27e0a28d1d521211ed17fb42901e8a7a972', name: 'stu', symbol: 'STU', fee_bps: 2000, platform: 'clanker' },
    { addr: '0x30f5bcb8bda2b91430be93dbae08ac346884eb07', name: 'Salvation 4 Humanity', symbol: 'S4H', fee_bps: 10000, platform: 'clanker' },
];

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

// Discover tokens via Basescan tokentx — find Clanker-launched tokens for this wallet
async function discoverFromBasescan(wallet) {
    const tokens = {};
    try {
        // Get ERC20 transfers TO this wallet — Clanker sends initial supply to creator
        const url = `https://api.basescan.org/api?module=account&action=tokentx&address=${wallet}&sort=desc&page=1&offset=200&apikey=${BASESCAN_KEY}`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.status !== '1' || !data.result) return tokens;
        for (const tx of data.result) {
            // Tokens sent FROM 0x0 or from a Clanker factory to this wallet = created by this wallet
            if (tx.to.toLowerCase() === wallet.toLowerCase() &&
                (tx.from === '0x0000000000000000000000000000000000000000' || tx.from.toLowerCase().startsWith('0x000000'))) {
                const addr = tx.contractAddress.toLowerCase();
                if (!tokens[addr]) {
                    tokens[addr] = { name: tx.tokenName || 'Unknown', symbol: tx.tokenSymbol || '???' };
                }
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

    // 1. Query everything in parallel
    const feesToClaimData = '0x8417645e' + pad32(wallet) + pad32(WETH_BASE);
    const [pendingWeth, ethPrice, dbResult, basescanTokens] = await Promise.all([
        rpcCall(CLANKER_FEE_LOCKER, feesToClaimData),
        fetchEthPrice(),
        supabase.from('inclawbator_projects')
            .select('id, token_name, token_symbol, token_address, chain, fee_split_bps, total_fees_claimed, status')
            .ilike('creator_wallet', wallet)
            .eq('status', 'active'),
        discoverFromBasescan(wallet)
    ]);

    const pendingUsd = pendingWeth * ethPrice;
    const dbProjects = dbResult.data || [];

    // 2. Merge all sources: DB → known ecosystem tokens → Basescan discovery
    const allTokens = new Map();

    // DB projects first (authoritative fee_split_bps)
    for (const p of dbProjects) {
        const chain = p.chain || 'base';
        if (chain === 'base' && p.token_address) {
            allTokens.set(p.token_address.toLowerCase(), {
                name: p.token_name,
                symbol: p.token_symbol,
                fee_split_bps: p.fee_split_bps || 10000,
                total_claimed: p.total_fees_claimed || 0,
                platform: 'clanker',
                source: 'project'
            });
        } else if (chain === 'solana' && p.token_address) {
            allTokens.set(p.token_address.toLowerCase(), {
                name: p.token_name,
                symbol: p.token_symbol,
                fee_split_bps: p.fee_split_bps || 8000,
                total_claimed: p.total_fees_claimed || 0,
                platform: 'bags',
                source: 'project'
            });
        }
    }

    // Known ecosystem tokens for admin wallet
    if (wallet === ADMIN_WALLET) {
        for (const t of KNOWN_TOKENS) {
            if (!allTokens.has(t.addr)) {
                allTokens.set(t.addr, {
                    name: t.name,
                    symbol: t.symbol,
                    fee_split_bps: t.fee_bps,
                    total_claimed: 0,
                    platform: t.platform || 'clanker',
                    source: 'ecosystem'
                });
            }
        }
    }

    // Basescan-discovered tokens
    for (const [addr, info] of Object.entries(basescanTokens)) {
        if (!allTokens.has(addr)) {
            allTokens.set(addr, {
                name: info.name,
                symbol: info.symbol,
                fee_split_bps: 10000,
                total_claimed: 0,
                platform: 'clanker',
                source: 'discovered'
            });
        }
    }

    // 3. Fetch DexScreener volumes (max 10)
    const entries = Array.from(allTokens.entries()).slice(0, 10);
    const tokenDetails = await Promise.all(
        entries.map(async ([addr, info]) => {
            const vol = await fetchTokenVolume(addr);
            const splitPct = (info.fee_split_bps || 10000) / 10000;
            const dailyFeeUsd = vol.volume24h * 0.01 * splitPct;
            const dailyFeeEth = ethPrice > 0 ? dailyFeeUsd / ethPrice : 0;
            return {
                token_name: vol.name !== 'Unknown' ? vol.name : info.name,
                token_symbol: vol.symbol !== '???' ? vol.symbol : info.symbol,
                token_address: addr,
                volume_24h: vol.volume24h,
                price: vol.price,
                fee_split_pct: Math.round(splitPct * 100),
                estimated_daily_eth: Math.round(dailyFeeEth * 1e8) / 1e8,
                estimated_daily_usd: Math.round(dailyFeeUsd * 100) / 100,
                total_claimed: info.total_claimed,
                platform: info.platform || 'clanker',
                source: info.source
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
