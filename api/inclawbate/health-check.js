// Token health check — fetches DexScreener + on-chain staking data (no AI/Groq)
// GET ?address=0x... → { token, staking, suggestions }

const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const CLAWS_STAKING = '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40';
const BASE_RPC = 'https://mainnet.base.org';

async function rpcRead(to, data) {
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

async function storageRead(contract, slot) {
    try {
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getStorageAt', params: [contract, slot, 'latest'], id: 1 })
        });
        const result = await res.json();
        if (result.error || !result.result || result.result === '0x') return 0;
        return Number(BigInt(result.result)) / 1e18;
    } catch (e) { return 0; }
}

function balanceOfData(addr) {
    return '0x70a08231000000000000000000000000' + addr.replace('0x', '').toLowerCase();
}

async function fetchClawsStaking(clawsPrice) {
    try {
        // Total CLAWS in staking contract (balanceOf = eth_call)
        const contractTotal = await rpcRead(CLAWS_ADDRESS, balanceOfData(CLAWS_STAKING));
        // Storage slot 6 = _totalSupply (user-staked amount, Synthetix layout) — must use eth_getStorageAt
        const userStaked = await storageRead(CLAWS_STAKING, '0x6');
        // rewardRate() function call
        const rewardRate = await rpcRead(CLAWS_STAKING, '0x7b0a47ee');

        const dailyRewards = rewardRate * 86400;
        const apy = userStaked > 0 ? (dailyRewards * 365 / userStaked * 100) : 0;
        const tvl = userStaked * (clawsPrice || 0);

        return {
            total_staked: Math.round(userStaked),
            tvl_usd: Math.round(tvl * 100) / 100,
            apy: Math.round(apy * 10) / 10,
            daily_rewards: Math.round(dailyRewards),
            rewards_pool: Math.round(Math.max(0, contractTotal - userStaked))
        };
    } catch (e) { return null; }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const address = (req.query.address || '').trim();
    if (!address) return res.status(400).json({ error: 'Missing address parameter' });

    const result = { token: null, staking: null, suggestions: [] };

    // DexScreener
    try {
        const dexRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + address);
        const dexData = await dexRes.json();
        const pairs = (dexData.pairs || []).filter(p => p.chainId === 'base' || p.chainId === 'solana');
        if (pairs.length) {
            const top = pairs[0];
            result.token = {
                name: top.baseToken?.name,
                symbol: top.baseToken?.symbol,
                price: top.priceUsd || 'N/A',
                change_24h: top.priceChange?.h24 ?? null,
                volume_24h: top.volume?.h24 || 0,
                liquidity: top.liquidity?.usd || 0,
                fdv: top.fdv || 0,
                pair_url: top.url || null
            };
            if ((top.volume?.h24 || 0) < 100) result.suggestions.push('Volume is very low — consider promoting your token or adding liquidity');
            if ((top.liquidity?.usd || 0) < 1000) result.suggestions.push('Liquidity is thin — consider adding more LP to reduce slippage');
            if ((top.priceChange?.h24 ?? 0) < -20) result.suggestions.push('Price dropped significantly — engage your community and highlight upcoming developments');
        } else {
            result.suggestions.push('No trading pairs found on DexScreener — your token may not be listed yet');
        }
    } catch (e) {
        result.suggestions.push('Could not reach DexScreener — try again in a moment');
    }

    // On-chain CLAWS staking (only if the token being checked is CLAWS)
    if (address.toLowerCase() === CLAWS_ADDRESS.toLowerCase()) {
        const price = result.token ? parseFloat(result.token.price) || 0 : 0;
        result.staking = await fetchClawsStaking(price);
    }

    if (!result.suggestions.length) result.suggestions.push('Looking healthy! Keep building and engaging your community.');

    return res.status(200).json(result);
}
