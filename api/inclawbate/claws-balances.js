// Proxy endpoint — fetch CLAWS balances (wallet + staked) for given addresses
// Browser can't call RPCs directly (CORS), so we proxy through here

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

async function rpcCall(to, data) {
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
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    const addresses = (req.query.addresses || '').split(',').filter(Boolean).slice(0, 20);
    if (!addresses.length) return res.status(400).json({ error: 'addresses param required' });

    const results = {};
    await Promise.all(addresses.map(async (addr) => {
        try {
            const padded = addr.slice(2).toLowerCase().padStart(64, '0');
            const calldata = '0x70a08231' + padded;

            const [walletHex, ...stakedHex] = await Promise.all([
                rpcCall(CLAWS_ADDRESS, calldata),
                ...STAKING_CONTRACTS.map(c => rpcCall(c, calldata))
            ]);

            let total = BigInt(walletHex);
            for (const h of stakedHex) total += BigInt(h);
            results[addr.toLowerCase()] = total.toString();
        } catch (e) {
            results[addr.toLowerCase()] = '0';
        }
    }));

    return res.status(200).json({ balances: results });
}
