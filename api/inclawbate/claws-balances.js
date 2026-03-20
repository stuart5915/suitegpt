// Proxy endpoint — fetch CLAWS balances (wallet + staked) for given addresses
// Uses batched eth_call to minimize RPC requests

const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379';
const STAKING_CONTRACTS = [
    '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6',
    '0x551d9dCd8B49893b9D0E1CA41a128ec202845F40'
];
const BASE_RPCS = [
    'https://base.llamarpc.com',
    'https://mainnet.base.org',
    'https://base.meowrpc.com'
];

async function batchRpcCalls(calls) {
    // Build JSON-RPC batch request
    const batch = calls.map((c, i) => ({
        jsonrpc: '2.0',
        id: i,
        method: 'eth_call',
        params: [{ to: c.to, data: c.data }, 'latest']
    }));

    for (const rpc of BASE_RPCS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const res = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const json = await res.json();

            // Batch response is an array
            if (Array.isArray(json)) {
                const results = new Array(calls.length).fill('0x0');
                for (const item of json) {
                    if (item.result && item.result !== '0x' && item.result.length > 2) {
                        results[item.id] = item.result;
                    }
                }
                return results;
            }

            // Some RPCs don't support batch — fall back to individual calls
            if (json.result) {
                // Single response (shouldn't happen with batch, but handle it)
                break;
            }
        } catch (err) {
            clearTimeout(timeout);
        }
    }

    // Fallback: sequential individual calls
    const results = [];
    for (const c of calls) {
        results.push(await singleRpcCall(c.to, c.data));
    }
    return results;
}

async function singleRpcCall(to, data) {
    for (const rpc of BASE_RPCS) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
            const res = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to, data }, 'latest'] }),
                signal: controller.signal
            });
            clearTimeout(timeout);
            const json = await res.json();
            if (json.result && json.result !== '0x' && json.result.length > 2) {
                return json.result;
            }
        } catch (err) {
            clearTimeout(timeout);
        }
    }
    return '0x0';
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    const addresses = (req.query.addresses || '').split(',').filter(Boolean).slice(0, 20);
    if (!addresses.length) return res.status(400).json({ error: 'addresses param required' });

    // Build all calls: for each address, 1 wallet balance + N staking balances
    const contracts = [CLAWS_ADDRESS, ...STAKING_CONTRACTS];
    const calls = [];
    const callMap = []; // track which address each call belongs to

    for (const addr of addresses) {
        const padded = addr.slice(2).toLowerCase().padStart(64, '0');
        const calldata = '0x70a08231' + padded;
        for (const contract of contracts) {
            calls.push({ to: contract, data: calldata });
            callMap.push(addr.toLowerCase());
        }
    }

    try {
        const results = await batchRpcCalls(calls);

        // Sum up balances per address
        const balances = {};
        for (const addr of addresses) {
            balances[addr.toLowerCase()] = '0';
        }

        for (let i = 0; i < results.length; i++) {
            const addr = callMap[i];
            try {
                const val = BigInt(results[i]);
                const prev = BigInt(balances[addr]);
                balances[addr] = (prev + val).toString();
            } catch (e) { /* skip bad hex */ }
        }

        return res.status(200).json({ balances });
    } catch (e) {
        console.error('claws-balances error:', e);
        return res.status(500).json({ error: 'RPC error' });
    }
}
