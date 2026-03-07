// Inclawbate — 0x Swap Quote Proxy
// GET /api/inclawbate/swap-quote?sellToken=...&buyToken=...&sellAmount=...&taker=...&chainId=8453
// Keeps ZEROX_API_KEY server-side

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { sellToken, buyToken, sellAmount, taker, chainId } = req.query;

    if (!sellToken || !buyToken || !sellAmount || !taker) {
        return res.status(400).json({ error: 'Missing required params: sellToken, buyToken, sellAmount, taker' });
    }

    const apiKey = process.env.ZEROX_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'ZEROX_API_KEY not configured' });
    }

    try {
        const params = new URLSearchParams({
            sellToken,
            buyToken,
            sellAmount,
            taker,
            chainId: chainId || '8453'
        });

        const resp = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
            headers: {
                '0x-api-key': apiKey,
                '0x-version': 'v2'
            }
        });

        const data = await resp.json();

        if (!resp.ok) {
            return res.status(resp.status).json({ error: data.reason || data.message || 'Quote failed', details: data });
        }

        return res.status(200).json({
            buyAmount: data.buyAmount,
            buyToken: data.buyToken,
            sellAmount: data.sellAmount,
            sellToken: data.sellToken,
            allowanceTarget: data.transaction?.to || data.allowanceTarget,
            transaction: data.transaction,
            price: data.price,
            estimatedGas: data.transaction?.gas
        });
    } catch (e) {
        return res.status(500).json({ error: 'Failed to fetch quote: ' + e.message });
    }
}
