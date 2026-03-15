// Inclawbate — Promo Slot Booking API
// GET  /api/inclawbate/promo           — list promo slots (filter by status, wallet)
// POST /api/inclawbate/promo           — book a promo slot

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';
const PROMO_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

const TIERS = {
    shoutout: { posts: 1, price: 10000, label: 'Shoutout' },
    campaign: { posts: 5, price: 40000, label: 'Campaign' },
    featured: { posts: 14, price: 100000, label: 'Featured' }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — list promo bookings
    if (req.method === 'GET') {
        const { status, wallet, limit } = req.query;
        let query = supabase
            .from('promo_queue')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(Math.min(parseInt(limit) || 20, 100));

        if (status) query = query.eq('status', status);
        if (wallet) query = query.eq('creator_wallet', wallet.toLowerCase());

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: 'Failed to fetch promos' });
        return res.status(200).json({ promos: data || [], tiers: TIERS });
    }

    // POST — book a promo slot
    if (req.method === 'POST') {
        const {
            project_name, project_url, token_address, description,
            tier, creator_wallet, payment_tx, payment_amount,
            x_handle, telegram_url
        } = req.body || {};

        if (!project_name) return res.status(400).json({ error: 'project_name required' });
        if (!tier || !TIERS[tier]) return res.status(400).json({ error: 'Invalid tier. Must be: shoutout, campaign, or featured' });
        if (!creator_wallet) return res.status(400).json({ error: 'creator_wallet required' });
        if (!payment_tx) return res.status(400).json({ error: 'payment_tx required — send CLAWS first, then share the tx hash' });

        // Verify payment_tx format
        if (!/^0x[0-9a-fA-F]{64}$/.test(payment_tx)) {
            return res.status(400).json({ error: 'Invalid transaction hash format' });
        }

        // Check for duplicate tx
        const { data: existing } = await supabase
            .from('promo_queue')
            .select('id')
            .eq('payment_tx', payment_tx)
            .single();

        if (existing) return res.status(400).json({ error: 'This transaction has already been used for a promo booking' });

        const { data, error } = await supabase
            .from('promo_queue')
            .insert({
                project_name: String(project_name).slice(0, 100),
                project_url: project_url ? String(project_url).slice(0, 500) : null,
                token_address: token_address || null,
                description: description ? String(description).slice(0, 500) : null,
                tier,
                posts_remaining: TIERS[tier].posts,
                creator_wallet: creator_wallet.toLowerCase(),
                payment_amount: payment_amount || TIERS[tier].price,
                payment_token: 'CLAWS',
                payment_tx,
                x_handle: x_handle ? String(x_handle).replace(/^@/, '').slice(0, 50) : null,
                telegram_url: telegram_url ? String(telegram_url).slice(0, 200) : null,
                status: 'pending'
            })
            .select()
            .single();

        if (error) {
            console.error('Promo insert error:', error);
            return res.status(500).json({ error: 'Failed to book promo slot' });
        }

        return res.status(201).json({
            success: true,
            promo: data,
            message: `${TIERS[tier].label} promo booked! ${TIERS[tier].posts} post(s) will be scheduled within 24 hours.`
        });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
