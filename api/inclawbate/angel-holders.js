// GET /api/inclawbate/angel-holders — enumerate unique Angel NFT holders on Base
// Public, read-only, cached 5 min

const ANGEL_NFT = '0x14d44d4d9f7898be1b9e1184a116502061eff5e7';
const RPC_URLS = ['https://mainnet.base.org', 'https://base.drpc.org', 'https://base.llamarpc.com'];
const SEL_TOTAL_MINTED = '0xa2309ff8';
const SEL_OWNER_OF = '0x6352211e';

function pad32(hex) {
    return hex.replace('0x', '').padStart(64, '0');
}

async function rpcCall(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('RPC error ' + res.status);
    return await res.json();
}

async function ethCall(to, data) {
    const body = { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] };
    for (const url of RPC_URLS) {
        try {
            const json = await rpcCall(url, body);
            if (json.result && json.result !== '0x') return json.result;
        } catch (e) { /* try next */ }
    }
    return '0x0';
}

async function batchCall(calls) {
    const batch = calls.map((c, i) => ({
        jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{ to: c.to, data: c.data }, 'latest']
    }));
    for (const url of RPC_URLS) {
        try {
            const json = await rpcCall(url, batch);
            if (Array.isArray(json)) {
                json.sort((a, b) => a.id - b.id);
                return json.map(r => r.result || '0x0');
            }
        } catch (e) { /* try next */ }
    }
    // Fallback: individual calls
    const results = [];
    for (const c of calls) {
        results.push(await ethCall(c.to, c.data));
    }
    return results;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const totalHex = await ethCall(ANGEL_NFT, SEL_TOTAL_MINTED);
        const totalMinted = Number(BigInt(totalHex));

        if (totalMinted === 0) {
            return res.status(200).json({ holders: [], total_minted: 0 });
        }

        const holders = {};
        const CHUNK = 50;

        for (let start = 1; start <= totalMinted; start += CHUNK) {
            const calls = [];
            const end = Math.min(start + CHUNK - 1, totalMinted);
            for (let id = start; id <= end; id++) {
                calls.push({ to: ANGEL_NFT, data: SEL_OWNER_OF + pad32('0x' + id.toString(16)) });
            }
            const results = await batchCall(calls);
            for (const r of results) {
                if (r.length < 66) continue;
                const owner = '0x' + r.slice(26);
                if (owner !== '0x0000000000000000000000000000000000000000') {
                    holders[owner.toLowerCase()] = true;
                }
            }
        }

        const list = Object.keys(holders);
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
        return res.status(200).json({ holders: list, total_minted: totalMinted });

    } catch (e) {
        return res.status(500).json({ error: 'Failed to enumerate holders', detail: e.message });
    }
}
