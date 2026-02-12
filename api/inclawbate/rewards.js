// Inclawbate — Weekly Rewards Config
// GET  — public, returns current reward config
// POST — admin wallet only, updates config

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('inclawbate_rewards')
            .select('*')
            .eq('id', 1)
            .single();

        if (error || !data) {
            return res.status(200).json({
                current_pool: 1000000,
                next_pool: 1000000,
                last_distributed: 0,
                total_distributed: 0,
                week_ends_at: null,
                top_n: 10
            });
        }

        return res.status(200).json(data);
    }

    if (req.method === 'POST') {
        const { wallet_address, current_pool, next_pool, last_distributed, total_distributed, week_ends_at, top_n } = req.body;

        if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const updates = { updated_at: new Date().toISOString() };
        if (current_pool !== undefined) updates.current_pool = current_pool;
        if (next_pool !== undefined) updates.next_pool = next_pool;
        if (last_distributed !== undefined) updates.last_distributed = last_distributed;
        if (total_distributed !== undefined) updates.total_distributed = total_distributed;
        if (week_ends_at !== undefined) updates.week_ends_at = week_ends_at;
        if (top_n !== undefined) updates.top_n = top_n;

        const { data, error } = await supabase
            .from('inclawbate_rewards')
            .update(updates)
            .eq('id', 1)
            .select('*')
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update', detail: error.message });
        }

        return res.status(200).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
