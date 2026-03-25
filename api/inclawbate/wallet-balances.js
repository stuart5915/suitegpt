// Inclawbate — Wallet Balances API
// GET /api/inclawbate/wallet-balances?wallet=0x...
// Returns ETH, USDC, CLAWS balances + staking position
// Server-side with 20s cache per wallet — never rate-limited

const BASE_RPC = 'https://mainnet.base.org';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING = '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40';
const BALANCEOF = '0x70a08231';
const EARNED = '0x008cc262';

// Simple in-memory cache: wallet → { data, time }
const cache = new Map();
const CACHE_TTL = 20_000; // 20 seconds

function pad(addr) {
  return '000000000000000000000000' + addr.toLowerCase().replace('0x', '');
}

function hexToNum(hex, decimals) {
  try {
    if (!hex || hex === '0x' || hex === '0x0') return 0;
    return Number(BigInt(hex)) / (10 ** decimals);
  } catch { return 0; }
}

function fmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  if (n < 0.001 && n > 0) return n.toFixed(6);
  return n.toFixed(n < 10 ? 4 : 2);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const wallet = (req.query.wallet || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // Check cache
  const cached = cache.get(wallet.toLowerCase());
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  const padded = pad(wallet);

  try {
    // Single batch RPC call — 5 reads in 1 HTTP request
    const batchBody = [
      { jsonrpc: '2.0', method: 'eth_getBalance', params: [wallet, 'latest'], id: 1 },
      { jsonrpc: '2.0', method: 'eth_call', params: [{ to: USDC, data: BALANCEOF + padded }, 'latest'], id: 2 },
      { jsonrpc: '2.0', method: 'eth_call', params: [{ to: CLAWS, data: BALANCEOF + padded }, 'latest'], id: 3 },
      { jsonrpc: '2.0', method: 'eth_call', params: [{ to: STAKING, data: BALANCEOF + padded }, 'latest'], id: 4 },
      { jsonrpc: '2.0', method: 'eth_call', params: [{ to: STAKING, data: EARNED + padded }, 'latest'], id: 5 },
    ];

    // Also fetch CLAWS price from DexScreener
    const [rpcRes, priceRes] = await Promise.all([
      fetch(BASE_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batchBody),
      }),
      fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS).catch(() => null),
    ]);

    const rpcData = await rpcRes.json();

    // Handle RPC error (non-array = rate limited)
    if (!Array.isArray(rpcData)) {
      if (cached) return res.status(200).json(cached.data); // return stale cache
      return res.status(503).json({ error: 'RPC temporarily unavailable' });
    }

    const byId = {};
    rpcData.forEach(r => { byId[r.id] = r.result; });

    const ethBal = hexToNum(byId[1], 18);
    const usdcBal = hexToNum(byId[2], 6);
    const clawsBal = hexToNum(byId[3], 18);
    const staked = hexToNum(byId[4], 18);
    const earned = hexToNum(byId[5], 18);

    // Parse prices
    let clawsPrice = 0;
    let ethPrice = 2500;
    try {
      const priceData = priceRes ? await priceRes.json() : {};
      const pair = (priceData.pairs || [])[0] || {};
      clawsPrice = parseFloat(pair.priceUsd || '0');
      if (pair.priceNative && clawsPrice > 0) {
        ethPrice = clawsPrice / parseFloat(pair.priceNative);
      }
      if (ethPrice < 100) ethPrice = 2500;
    } catch { /* use defaults */ }

    const total = (ethBal * ethPrice) + usdcBal + (clawsBal * clawsPrice) + (staked * clawsPrice);

    const data = {
      wallet,
      eth: { balance: fmt(ethBal), raw: ethBal, usd: '$' + fmt(ethBal * ethPrice) },
      usdc: { balance: fmt(usdcBal), raw: usdcBal, usd: '$' + fmt(usdcBal) },
      claws: { balance: fmt(clawsBal), raw: clawsBal, usd: clawsPrice > 0 ? '$' + fmt(clawsBal * clawsPrice) : '$0.00' },
      staking: {
        staked: fmt(staked),
        stakedRaw: staked,
        earned: fmt(earned),
        earnedRaw: earned,
        active: staked > 0,
      },
      total: '$' + fmt(total),
      prices: { eth: ethPrice, claws: clawsPrice },
      cached: false,
    };

    // Cache it
    cache.set(wallet.toLowerCase(), { data, time: Date.now() });

    // Clean old entries (prevent memory leak)
    if (cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of cache) {
        if (now - v.time > 60_000) cache.delete(k);
      }
    }

    return res.status(200).json(data);
  } catch (e) {
    console.error('Wallet balances error:', e.message);
    if (cached) return res.status(200).json({ ...cached.data, cached: true });
    return res.status(500).json({ error: 'Failed to fetch balances' });
  }
}
