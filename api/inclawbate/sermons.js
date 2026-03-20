// Inclawbate — Sermons API (team-gated)
// GET              — list sermons for wallet (or single by ?id=)
// POST action:save — create or update sermon
// POST action:delete — delete sermon by id

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function authenticateWallet(req) {
    const wallet = req.headers['x-wallet-address'];
    if (!wallet) return null;
    const addr = wallet.toLowerCase();
    const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('wallet_address', addr)
        .single();
    return data || null;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Wallet-Address');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET — list or single sermon ──
    if (req.method === 'GET') {
        const member = await authenticateWallet(req);
        if (!member) return res.status(403).json({ error: 'Not a team member' });

        const addr = member.wallet_address;
        const sermonId = req.query.id;

        if (sermonId) {
            const { data, error } = await supabase
                .from('sermons')
                .select('*')
                .eq('id', sermonId)
                .eq('wallet_address', addr)
                .single();
            if (error) return res.status(404).json({ error: 'Sermon not found' });
            return res.status(200).json({ sermon: data });
        }

        const { data, error } = await supabase
            .from('sermons')
            .select('id, title, updated_at, created_at')
            .eq('wallet_address', addr)
            .order('updated_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ sermons: data || [] });
    }

    // ── POST — save or delete ──
    if (req.method === 'POST') {
        const member = await authenticateWallet(req);
        if (!member) return res.status(403).json({ error: 'Not a team member' });

        const { action } = req.body;
        const addr = member.wallet_address;

        // ── Save (create or update) ──
        if (action === 'save') {
            const { id, title, content_html, font_family, font_size, line_spacing } = req.body;

            if (id) {
                // Update existing
                const updates = { updated_at: new Date().toISOString() };
                if (title !== undefined) updates.title = title;
                if (content_html !== undefined) updates.content_html = content_html;
                if (font_family !== undefined) updates.font_family = font_family;
                if (font_size !== undefined) updates.font_size = font_size;
                if (line_spacing !== undefined) updates.line_spacing = line_spacing;

                const { data, error } = await supabase
                    .from('sermons')
                    .update(updates)
                    .eq('id', id)
                    .eq('wallet_address', addr)
                    .select()
                    .single();

                if (error) return res.status(500).json({ error: error.message });
                return res.status(200).json({ sermon: data });
            } else {
                // Create new
                const { data, error } = await supabase
                    .from('sermons')
                    .insert({
                        wallet_address: addr,
                        title: title || 'Untitled Sermon',
                        content_html: content_html || '',
                        font_family: font_family || 'Caveat',
                        font_size: font_size || '18px',
                        line_spacing: line_spacing || '29px'
                    })
                    .select()
                    .single();

                if (error) return res.status(500).json({ error: error.message });
                return res.status(201).json({ sermon: data });
            }
        }

        // ── Delete ──
        if (action === 'delete') {
            const { id } = req.body;
            if (!id) return res.status(400).json({ error: 'id required' });

            const { error } = await supabase
                .from('sermons')
                .delete()
                .eq('id', id)
                .eq('wallet_address', addr);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
