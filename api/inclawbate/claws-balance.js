// Returns on-chain CLAWS token balance for a wallet
const CLAWS_TOKEN = '0x7ca47B141639B893C6782823C0b219f872056379';
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

async function rpcCall(method, params) {
    for (const rpc of BASE_RPCS) {
        try {
            const resp = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            const data = await resp.json();
            if (data.result) return data.result;
        } catch (e) { continue; }
    }
    return null;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(204).end();

    const wallet = (req.query.wallet || '').trim();
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'Invalid wallet address' });
    }

    try {
        const paddedAddr = '0x000000000000000000000000' + wallet.replace('0x', '').toLowerCase();
        const callData = '0x70a08231' + paddedAddr.replace('0x', '');

        const result = await rpcCall('eth_call', [{ to: CLAWS_TOKEN, data: callData }, 'latest']);

        if (!result || result === '0x') {
            return res.status(200).json({ balance: 0, formatted: '0' });
        }

        // CLAWS has 18 decimals
        const raw = BigInt(result);
        const balance = Number(raw / BigInt(1e14)) / 10000;

        let formatted;
        if (balance >= 1e9) formatted = (balance / 1e9).toFixed(2) + 'B';
        else if (balance >= 1e6) formatted = (balance / 1e6).toFixed(1) + 'M';
        else if (balance >= 1e3) formatted = (balance / 1e3).toFixed(1) + 'K';
        else formatted = Math.round(balance).toLocaleString();

        return res.status(200).json({ balance, formatted });
    } catch (e) {
        return res.status(500).json({ error: e.message || 'Failed to fetch balance' });
    }
}
