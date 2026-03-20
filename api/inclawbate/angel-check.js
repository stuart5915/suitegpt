// Angel NFT holder check
// GET /api/inclawbate/angel-check?wallet=0x...
// Returns { isAngel: boolean }
// Also exports checkAngelHolder(wallet) for server-side use

const ANGEL_NFT_CONTRACT = '0x14d44d4d9f7898be1b9e1184a116502061eff5e7';
const BASE_RPC = 'https://mainnet.base.org';

// In-memory cache: wallet → { isAngel, expiry }
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ERC-721 balanceOf(address) → uint256
const BALANCE_OF_SELECTOR = '0x70a08231';

export async function checkAngelHolder(wallet) {
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) return false;

    const key = wallet.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expiry) return cached.isAngel;

    try {
        const paddedAddr = '000000000000000000000000' + key.slice(2);
        const data = BALANCE_OF_SELECTOR + paddedAddr;

        const resp = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_call',
                params: [{ to: ANGEL_NFT_CONTRACT, data }, 'latest']
            })
        });

        const json = await resp.json();
        const balance = parseInt(json.result, 16);
        const isAngel = balance > 0;

        cache.set(key, { isAngel, expiry: Date.now() + CACHE_TTL });
        return isAngel;
    } catch (e) {
        console.error('Angel check failed:', e);
        return false;
    }
}

export default async function handler(req, res) {
    // CORS
    const origin = req.headers.origin;
    const allowed = ['https://inclawbate.app', 'https://www.inclawbate.app', 'https://inclawbate.app', 'https://www.inclawbate.app'];
    if (allowed.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const wallet = req.query.wallet;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const isAngel = await checkAngelHolder(wallet);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
    return res.json({ isAngel });
}
