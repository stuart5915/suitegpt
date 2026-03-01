// Inclawbate — Team Kanban Board API
// GET                        — returns columns + cards + members (team member auth)
// POST action:"add-card"     — create a card
// POST action:"update-card"  — move/edit a card
// POST action:"delete-card"  — remove a card
// POST action:"add-column"   — create column (admin only)
// POST action:"delete-column" — remove column (admin only)
// POST action:"add-member"   — add wallet to team (admin only)
// POST action:"remove-member" — remove from team (admin only)

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Auth: wallet address from request, checked against team_members
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

    // ── GET — full board state ──
    if (req.method === 'GET') {
        const member = await authenticateWallet(req);
        if (!member) return res.status(403).json({ error: 'Not a team member' });

        const [colRes, cardRes, memRes] = await Promise.all([
            supabase.from('team_columns').select('*').order('position'),
            supabase.from('team_cards').select('*').order('position'),
            supabase.from('team_members').select('id, wallet_address, display_name, role, created_at')
        ]);

        return res.status(200).json({
            columns: colRes.data || [],
            cards: cardRes.data || [],
            members: memRes.data || [],
            me: { id: member.id, role: member.role, display_name: member.display_name }
        });
    }

    // ── POST — actions ──
    if (req.method === 'POST') {
        const member = await authenticateWallet(req);
        if (!member) return res.status(403).json({ error: 'Not a team member' });

        const { action } = req.body;
        const isAdmin = member.role === 'admin';

        // ── Add card ──
        if (action === 'add-card') {
            const { title, description, column_id, priority, assigned_to } = req.body;
            if (!title || !column_id) return res.status(400).json({ error: 'title and column_id required' });

            // Get max position in column
            const { data: existing } = await supabase
                .from('team_cards')
                .select('position')
                .eq('column_id', column_id)
                .order('position', { ascending: false })
                .limit(1);
            const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

            const { data, error } = await supabase
                .from('team_cards')
                .insert({
                    title,
                    description: description || null,
                    column_id,
                    priority: priority || 'normal',
                    assigned_to: assigned_to || null,
                    position: nextPos,
                    created_by: member.id
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ card: data });
        }

        // ── Update card ──
        if (action === 'update-card') {
            const { card_id, column_id, position, title, description, priority, assigned_to } = req.body;
            if (!card_id) return res.status(400).json({ error: 'card_id required' });

            const updates = { updated_at: new Date().toISOString() };
            if (column_id !== undefined) updates.column_id = column_id;
            if (position !== undefined) updates.position = position;
            if (title !== undefined) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (priority !== undefined) updates.priority = priority;
            if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;

            const { data, error } = await supabase
                .from('team_cards')
                .update(updates)
                .eq('id', card_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ card: data });
        }

        // ── Delete card ──
        if (action === 'delete-card') {
            const { card_id } = req.body;
            if (!card_id) return res.status(400).json({ error: 'card_id required' });

            const { error } = await supabase
                .from('team_cards')
                .delete()
                .eq('id', card_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Add column (admin) ──
        if (action === 'add-column') {
            if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
            const { title } = req.body;
            if (!title) return res.status(400).json({ error: 'title required' });

            const { data: existing } = await supabase
                .from('team_columns')
                .select('position')
                .order('position', { ascending: false })
                .limit(1);
            const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

            const { data, error } = await supabase
                .from('team_columns')
                .insert({ title, position: nextPos })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ column: data });
        }

        // ── Delete column (admin) ──
        if (action === 'delete-column') {
            if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
            const { column_id } = req.body;
            if (!column_id) return res.status(400).json({ error: 'column_id required' });

            const { error } = await supabase
                .from('team_columns')
                .delete()
                .eq('id', column_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Add member (admin) ──
        if (action === 'add-member') {
            if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
            const { wallet_address, display_name } = req.body;
            if (!wallet_address) return res.status(400).json({ error: 'wallet_address required' });

            const { data, error } = await supabase
                .from('team_members')
                .insert({
                    wallet_address: wallet_address.toLowerCase(),
                    display_name: display_name || null
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') return res.status(409).json({ error: 'Wallet already on team' });
                return res.status(500).json({ error: error.message });
            }
            return res.status(201).json({ member: data });
        }

        // ── Remove member (admin) ──
        if (action === 'remove-member') {
            if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
            const { member_id } = req.body;
            if (!member_id) return res.status(400).json({ error: 'member_id required' });

            // Don't allow removing yourself
            if (member_id === member.id) return res.status(400).json({ error: 'Cannot remove yourself' });

            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('id', member_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
