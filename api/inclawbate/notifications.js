// Inclawbate — Notifications
// GET ?wallet=0x...          → list notifications (newest first, unread count)
// POST action:"mark_read"    → mark one or all as read

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

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
        const wallet = req.query.wallet;
        if (!wallet || !/^0x[a-fA-F0-9]{40}$/i.test(wallet)) {
            return res.status(400).json({ error: 'Valid wallet required' });
        }

        const w = wallet.toLowerCase();

        // Get notifications (last 50)
        const { data: notifications } = await supabase
            .from('inclawbate_notifications')
            .select('*')
            .eq('wallet_address', w)
            .order('created_at', { ascending: false })
            .limit(50);

        // Get unread count
        const { count } = await supabase
            .from('inclawbate_notifications')
            .select('*', { count: 'exact', head: true })
            .eq('wallet_address', w)
            .eq('read', false);

        // Fetch handles for from_wallet addresses
        const fromWallets = [...new Set((notifications || []).map(n => n.from_wallet))];
        const handles = fromWallets.length > 0 ? await getHandles(fromWallets) : {};

        const result = (notifications || []).map(n => ({
            ...n,
            from_handle: handles[n.from_wallet] || null
        }));

        return res.status(200).json({
            notifications: result,
            unread_count: count || 0
        });
    }

    if (req.method === 'POST') {
        const { action, wallet_address, notification_id } = req.body;

        if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/i.test(wallet_address)) {
            return res.status(400).json({ error: 'Valid wallet_address required' });
        }

        const w = wallet_address.toLowerCase();

        if (action === 'mark_read') {
            if (notification_id) {
                // Mark single notification as read
                await supabase
                    .from('inclawbate_notifications')
                    .update({ read: true })
                    .eq('id', notification_id)
                    .eq('wallet_address', w);
            } else {
                // Mark all as read
                await supabase
                    .from('inclawbate_notifications')
                    .update({ read: true })
                    .eq('wallet_address', w)
                    .eq('read', false);
            }

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function getHandles(wallets) {
    if (wallets.length === 0) return {};
    const { data } = await supabase
        .from('human_profiles')
        .select('wallet_address, x_handle')
        .in('wallet_address', wallets);

    const map = {};
    for (const row of (data || [])) {
        if (row.x_handle) map[row.wallet_address] = row.x_handle;
    }
    return map;
}
