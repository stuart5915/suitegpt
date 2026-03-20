// Inclawbate — Store Orders API
// POST {action:"create", tx_hash, shipping, product} — place order after INCLAWNCH payment
// POST {action:"status", order_id}                    — check order status (JWT)
// POST {action:"list"}                                — list user's orders (JWT)
// POST {action:"admin-list", admin_secret}             — list all orders (admin)
// POST {action:"admin-update", order_id, status, tracking_number, admin_secret} — update order

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'.toLowerCase();
const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd'.toLowerCase();
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Pricing: USD equivalent per shipping tier (putter + shipping + slippage + burn)
const PRODUCTS = {
    'lobster-putter': {
        name: 'The Lobster Putter',
        us: 249,
        canada: 269,
        international: 299
    }
};

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Reuse same RPC + price fetching pattern from credits.js
const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

async function rpcCall(method, params) {
    for (let i = 0; i < BASE_RPCS.length; i++) {
        try {
            const resp = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            if (resp.status === 429) continue;
            const data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { /* try next */ }
    }
    return null;
}

async function fetchInclawnchPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
            return parseFloat(data.pairs[0].priceUsd) || 0;
        }
    } catch (e) { /* */ }
    return 0;
}

async function verifyTransferTx(txHash, minAmount) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Transaction failed or not found' };
    }

    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === CLAWNCH_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No INCLAWNCH transfer found in transaction' };
    }

    const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
    const amount = Number(BigInt(transferLog.data)) / 1e18;

    if (to !== PROTOCOL_WALLET) {
        return { valid: false, reason: 'Transfer was not sent to the protocol wallet' };
    }

    if (amount < minAmount * 0.99) { // 1% tolerance for rounding
        return { valid: false, reason: `Insufficient payment. Expected ~${Math.ceil(minAmount)} INCLAWNCH, got ${Math.floor(amount)}` };
    }

    return { valid: true, amount };
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — price quote
    if (req.method === 'GET') {
        const product = req.query.product || 'lobster-putter';
        const tier = req.query.tier || 'us';
        const p = PRODUCTS[product];
        if (!p) return res.status(404).json({ error: 'Product not found' });

        const usdPrice = p[tier];
        if (!usdPrice) return res.status(400).json({ error: 'Invalid shipping tier' });

        const livePrice = await fetchInclawnchPrice();
        if (livePrice <= 0) {
            return res.status(503).json({ error: 'Unable to fetch INCLAWNCH price' });
        }

        const inclawnchAmount = Math.ceil(usdPrice / livePrice);

        return res.status(200).json({
            product,
            name: p.name,
            tier,
            usd_price: usdPrice,
            inclawnch_price: livePrice,
            inclawnch_amount: inclawnchAmount,
            protocol_wallet: PROTOCOL_WALLET,
            tiers: {
                us: { usd: p.us, inclawnch: Math.ceil(p.us / livePrice) },
                canada: { usd: p.canada, inclawnch: Math.ceil(p.canada / livePrice) },
                international: { usd: p.international, inclawnch: Math.ceil(p.international / livePrice) }
            }
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body;

    // ── Create order ──
    if (action === 'create') {
        const user = authenticateRequest(req);
        if (!user) {
            return res.status(401).json({ error: 'Authentication required. Log in at inclawbate.app/launch first.' });
        }

        const { tx_hash, shipping, product = 'lobster-putter' } = req.body;

        // Validate product
        const p = PRODUCTS[product];
        if (!p) return res.status(400).json({ error: 'Unknown product' });

        // Validate tx_hash
        if (!tx_hash || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
            return res.status(400).json({ error: 'Valid tx_hash required' });
        }

        // Validate shipping
        if (!shipping || !shipping.name || !shipping.address || !shipping.city ||
            !shipping.state || !shipping.zip || !shipping.country || !shipping.tier) {
            return res.status(400).json({ error: 'Complete shipping information required' });
        }

        const tier = shipping.tier;
        if (!['us', 'canada', 'international'].includes(tier)) {
            return res.status(400).json({ error: 'Invalid shipping tier' });
        }

        // Check duplicate tx
        const { data: existing } = await supabase
            .from('inclawbate_orders')
            .select('id')
            .eq('tx_hash', tx_hash.toLowerCase())
            .single();

        if (existing) {
            return res.status(409).json({ error: 'This transaction has already been used for an order' });
        }

        // Get live price + expected amount
        const livePrice = await fetchInclawnchPrice();
        if (livePrice <= 0) {
            return res.status(503).json({ error: 'Unable to fetch INCLAWNCH price. Try again shortly.' });
        }

        const usdPrice = p[tier];
        const expectedInclawnch = Math.ceil(usdPrice / livePrice);

        // Verify on-chain
        const verification = await verifyTransferTx(tx_hash, expectedInclawnch);
        if (!verification.valid) {
            return res.status(400).json({ error: verification.reason });
        }

        // Record order
        const { data: order, error: insertErr } = await supabase
            .from('inclawbate_orders')
            .insert({
                profile_id: user.sub,
                product,
                shipping_name: shipping.name,
                shipping_address: shipping.address,
                shipping_city: shipping.city,
                shipping_state: shipping.state,
                shipping_zip: shipping.zip,
                shipping_country: shipping.country,
                shipping_tier: tier,
                inclawnch_amount: verification.amount,
                usd_equivalent: usdPrice,
                inclawnch_price_at_purchase: livePrice,
                tx_hash: tx_hash.toLowerCase(),
                status: 'confirmed'
            })
            .select('id, status, created_at')
            .single();

        if (insertErr) {
            if (insertErr.code === '23505') {
                return res.status(409).json({ error: 'Duplicate transaction' });
            }
            return res.status(500).json({ error: 'Failed to record order' });
        }

        return res.status(200).json({
            order_id: order.id,
            status: order.status,
            product: p.name,
            inclawnch_paid: Math.floor(verification.amount),
            usd_equivalent: usdPrice,
            message: 'Order confirmed! We\'ll start processing your Lobster Putter. Made-to-order, ships in 2-3 weeks.'
        });
    }

    // ── List my orders ──
    if (action === 'list') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Auth required' });

        const { data, error } = await supabase
            .from('inclawbate_orders')
            .select('id, product, status, tracking_number, inclawnch_amount, usd_equivalent, created_at, shipped_at')
            .eq('profile_id', user.sub)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch orders' });
        return res.status(200).json({ orders: data || [] });
    }

    // ── Admin: list all orders ──
    if (action === 'admin-list') {
        const { admin_secret } = req.body;
        if (!admin_secret || admin_secret !== process.env.INCLAWBATE_ADMIN_SECRET) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('inclawbate_orders')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: 'Failed to fetch orders' });
        return res.status(200).json({ orders: data || [] });
    }

    // ── Admin: update order status ──
    if (action === 'admin-update') {
        const { admin_secret, order_id, status, tracking_number } = req.body;
        if (!admin_secret || admin_secret !== process.env.INCLAWBATE_ADMIN_SECRET) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (!order_id) return res.status(400).json({ error: 'order_id required' });

        const updates = {};
        if (status) updates.status = status;
        if (tracking_number) updates.tracking_number = tracking_number;
        if (status === 'shipped') updates.shipped_at = new Date().toISOString();
        if (status === 'delivered') updates.delivered_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('inclawbate_orders')
            .update(updates)
            .eq('id', order_id)
            .select('id, status, tracking_number')
            .single();

        if (error) return res.status(500).json({ error: 'Failed to update order' });
        return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Unknown action' });
}
