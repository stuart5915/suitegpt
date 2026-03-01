// Inclawbate — Team Kanban Board API
// GET                             — returns columns + cards + members + channels (team member auth)
// GET ?messages_channel=ID        — returns messages for channel (last 50, or after timestamp)
// POST action:"add-card"          — create a card (member+)
// POST action:"update-card"       — move/edit a card (member own, editor+ any)
// POST action:"delete-card"       — remove a card (member own, editor+ any)
// POST action:"add-column"        — create column (admin only)
// POST action:"delete-column"     — remove column (admin only)
// POST action:"add-member"        — add wallet to team (admin only)
// POST action:"remove-member"     — remove from team (admin only)
// POST action:"update-member-role"— change a member's role (admin only)
// POST action:"send-message"      — send chat message (all roles)

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Role hierarchy ──
const ROLE_LEVELS = { viewer: 0, member: 1, editor: 2, admin: 3 };

function hasRole(member, minRole) {
    return (ROLE_LEVELS[member.role] || 0) >= (ROLE_LEVELS[minRole] || 0);
}

// ── Rate limiting for chat (in-memory, resets on cold start) ──
const chatRateMap = new Map(); // memberId -> { count, windowStart }
const CHAT_RATE_LIMIT = 30;   // messages per minute

function checkChatRate(memberId) {
    const now = Date.now();
    const entry = chatRateMap.get(memberId);
    if (!entry || now - entry.windowStart > 60000) {
        chatRateMap.set(memberId, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= CHAT_RATE_LIMIT) return false;
    entry.count++;
    return true;
}

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

    // ── GET — full board state + optional messages ──
    if (req.method === 'GET') {
        const member = await authenticateWallet(req);
        if (!member) return res.status(403).json({ error: 'Not a team member' });

        // If requesting messages for a channel
        const msgChannel = req.query.messages_channel;
        if (msgChannel) {
            let query = supabase
                .from('team_messages')
                .select('*')
                .eq('channel_id', msgChannel)
                .order('created_at', { ascending: true });

            const after = req.query.messages_after;
            if (after) {
                query = query.gt('created_at', after);
            } else {
                query = query.limit(50);
            }

            const { data, error } = await query;
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ messages: data || [] });
        }

        const [colRes, cardRes, memRes, chanRes] = await Promise.all([
            supabase.from('team_columns').select('*').order('position'),
            supabase.from('team_cards').select('*').order('position'),
            supabase.from('team_members').select('id, wallet_address, display_name, role, created_at'),
            supabase.from('team_channels').select('*').order('position')
        ]);

        return res.status(200).json({
            columns: colRes.data || [],
            cards: cardRes.data || [],
            members: memRes.data || [],
            channels: chanRes.data || [],
            me: { id: member.id, role: member.role, display_name: member.display_name }
        });
    }

    // ── POST — actions ──
    if (req.method === 'POST') {
        const member = await authenticateWallet(req);
        if (!member) return res.status(403).json({ error: 'Not a team member' });

        const { action } = req.body;

        // ── Add card (member+) ──
        if (action === 'add-card') {
            if (!hasRole(member, 'member')) return res.status(403).json({ error: 'Members and above can create cards' });

            const { title, description, column_id, priority, assigned_to } = req.body;
            if (!title || !column_id) return res.status(400).json({ error: 'title and column_id required' });

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

        // ── Update card (member own, editor+ any) ──
        if (action === 'update-card') {
            const { card_id, column_id, position, title, description, priority, assigned_to } = req.body;
            if (!card_id) return res.status(400).json({ error: 'card_id required' });

            // Check permission
            if (!hasRole(member, 'member')) return res.status(403).json({ error: 'Viewers cannot edit cards' });

            if (!hasRole(member, 'editor')) {
                // member can only edit own cards
                const { data: card } = await supabase.from('team_cards').select('created_by').eq('id', card_id).single();
                if (!card || card.created_by !== member.id) {
                    return res.status(403).json({ error: 'Members can only edit their own cards' });
                }
            }

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

        // ── Delete card (member own, editor+ any) ──
        if (action === 'delete-card') {
            const { card_id } = req.body;
            if (!card_id) return res.status(400).json({ error: 'card_id required' });

            if (!hasRole(member, 'member')) return res.status(403).json({ error: 'Viewers cannot delete cards' });

            if (!hasRole(member, 'editor')) {
                const { data: card } = await supabase.from('team_cards').select('created_by').eq('id', card_id).single();
                if (!card || card.created_by !== member.id) {
                    return res.status(403).json({ error: 'Members can only delete their own cards' });
                }
            }

            const { error } = await supabase
                .from('team_cards')
                .delete()
                .eq('id', card_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Add column (admin) ──
        if (action === 'add-column') {
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
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
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
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
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
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
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
            const { member_id } = req.body;
            if (!member_id) return res.status(400).json({ error: 'member_id required' });

            if (member_id === member.id) return res.status(400).json({ error: 'Cannot remove yourself' });

            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('id', member_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Update member role (admin) ──
        if (action === 'update-member-role') {
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
            const { member_id, role } = req.body;
            if (!member_id || !role) return res.status(400).json({ error: 'member_id and role required' });
            if (!ROLE_LEVELS.hasOwnProperty(role)) return res.status(400).json({ error: 'Invalid role' });
            if (member_id === member.id) return res.status(400).json({ error: 'Cannot change your own role' });

            const { data, error } = await supabase
                .from('team_members')
                .update({ role })
                .eq('id', member_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ member: data });
        }

        // ── Send message (all roles) ──
        if (action === 'send-message') {
            const { channel_id, content } = req.body;
            if (!channel_id || !content || !content.trim()) {
                return res.status(400).json({ error: 'channel_id and content required' });
            }

            if (!checkChatRate(member.id)) {
                return res.status(429).json({ error: 'Rate limit: max 30 messages per minute' });
            }

            const { data, error } = await supabase
                .from('team_messages')
                .insert({
                    channel_id,
                    sender_id: member.id,
                    content: content.trim().slice(0, 2000)
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ message: data });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
