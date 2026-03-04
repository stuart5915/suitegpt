import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://salvation4humanity.com',
    'https://www.salvation4humanity.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, wallet_address, prayer_text, prayer_id, is_private } = req.body;

    if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
        return res.status(400).json({ error: 'Valid wallet address required' });
    }

    const addr = wallet_address.toLowerCase();

    if (action === 'submit') {
        if (!prayer_text || typeof prayer_text !== 'string') {
            return res.status(400).json({ error: 'Prayer text required' });
        }

        // Strip HTML and enforce max length
        const cleaned = prayer_text.replace(/<[^>]*>/g, '').trim().slice(0, 1000);
        if (!cleaned) return res.status(400).json({ error: 'Prayer text required' });

        // Rate limit: 5 per wallet per day
        const dayAgo = new Date(Date.now() - 86400000).toISOString();
        const { count } = await supabase
            .from('prayer_requests')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', addr)
            .gte('created_at', dayAgo);

        if (count >= 5) {
            return res.status(429).json({ error: 'Limit 5 prayers per day' });
        }

        const { data, error } = await supabase
            .from('prayer_requests')
            .insert({ wallet_address: addr, prayer_text: cleaned, is_private: !!is_private })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ prayer: data });
    }

    if (action === 'pray') {
        if (!prayer_id) return res.status(400).json({ error: 'prayer_id required' });

        // Check if already prayed
        const { data: existing } = await supabase
            .from('prayer_prays')
            .select('id')
            .eq('wallet_address', addr)
            .eq('prayer_id', prayer_id)
            .maybeSingle();

        if (existing) {
            // Un-pray (toggle off)
            const { error } = await supabase
                .from('prayer_prays')
                .delete()
                .eq('id', existing.id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ prayed: false });
        } else {
            // Pray (toggle on)
            const { error } = await supabase
                .from('prayer_prays')
                .insert({ wallet_address: addr, prayer_id });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ prayed: true });
        }
    }

    if (action === 'delete') {
        if (!prayer_id) return res.status(400).json({ error: 'prayer_id required' });

        const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
        const isAdmin = addr === SUPER_ADMIN;

        // Fetch the prayer to check ownership
        const { data: prayer } = await supabase
            .from('prayer_requests')
            .select('wallet_address')
            .eq('id', prayer_id)
            .maybeSingle();

        if (!prayer) return res.status(404).json({ error: 'Prayer not found' });

        if (prayer.wallet_address !== addr && !isAdmin) {
            return res.status(403).json({ error: 'Not authorized to delete this prayer' });
        }

        // Delete associated prays first (cascade should handle it, but be safe)
        await supabase.from('prayer_prays').delete().eq('prayer_id', prayer_id);
        const { error } = await supabase.from('prayer_requests').delete().eq('id', prayer_id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ deleted: true });
    }

    return res.status(400).json({ error: 'Invalid action. Use "submit", "pray", or "delete".' });
}
