// Inclawbate — Team Kanban Board API (Multi-Board)
// GET                             — returns boards + columns + cards + members + channels for a board
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
// POST action:"add-channel"       — create channel (admin only)
// POST action:"delete-channel"    — remove channel (admin only)
// POST action:"add-board"         — create board (admin only)
// POST action:"delete-board"      — remove board + cascade (admin only)
// GET  ?calendar_board=ID&calendar_month=YYYY-MM — calendar events for board/month
// POST action:"add-event"         — create calendar event (member+)
// POST action:"update-event"      — edit calendar event (member own, editor+ any)
// POST action:"delete-event"      — remove calendar event (member own, editor+ any)

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

// Resolve board slug to board id; returns the board row or null
async function resolveBoard(slug) {
    if (!slug) {
        // Default to first board by position
        const { data } = await supabase
            .from('team_boards')
            .select('*')
            .order('position')
            .limit(1);
        return (data && data[0]) || null;
    }
    const { data } = await supabase
        .from('team_boards')
        .select('*')
        .eq('slug', slug)
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

        // If requesting calendar events for a board+month
        const calBoard = req.query.calendar_board;
        const calMonth = req.query.calendar_month; // YYYY-MM
        if (calBoard && calMonth) {
            const [y, m] = calMonth.split('-').map(Number);
            if (!y || !m || m < 1 || m > 12) return res.status(400).json({ error: 'Invalid calendar_month (YYYY-MM)' });
            const firstDay = `${calMonth}-01`;
            const lastDay = new Date(y, m, 0).toISOString().slice(0, 10); // last day of month
            const { data, error } = await supabase
                .from('team_calendar_events')
                .select('*')
                .eq('board_id', calBoard)
                .gte('event_date', firstDay)
                .lte('event_date', lastDay)
                .order('event_date')
                .order('event_time', { nullsFirst: false });
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ events: data || [] });
        }

        // Resolve active board
        const boardSlug = req.query.board || null;
        const board = await resolveBoard(boardSlug);
        if (!board) return res.status(404).json({ error: 'Board not found' });

        const [boardsRes, colRes, cardRes, memRes, chanRes] = await Promise.all([
            supabase.from('team_boards').select('*').order('position'),
            supabase.from('team_columns').select('*').eq('board_id', board.id).order('position'),
            supabase.from('team_cards').select('*').eq('board_id', board.id).order('position'),
            supabase.from('team_members').select('id, wallet_address, display_name, role, created_at'),
            supabase.from('team_channels').select('*').eq('board_id', board.id).order('position')
        ]);

        return res.status(200).json({
            boards: boardsRes.data || [],
            activeBoard: board,
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

            const { title, description, column_id, priority, assigned_to, assign_all, board_id } = req.body;
            if (!title || !column_id) return res.status(400).json({ error: 'title and column_id required' });
            if (!board_id) return res.status(400).json({ error: 'board_id required' });

            const isAll = assign_all === true;

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
                    board_id,
                    priority: priority || 'normal',
                    assigned_to: isAll ? null : (assigned_to || null),
                    assign_all: isAll,
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
            const { card_id, column_id, position, title, description, priority, assigned_to, assign_all } = req.body;
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
            if (assign_all !== undefined) {
                updates.assign_all = assign_all === true;
                if (assign_all === true) updates.assigned_to = null;
            }
            if (assigned_to !== undefined && assign_all !== true) updates.assigned_to = assigned_to || null;

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
            const { title, board_id } = req.body;
            if (!title) return res.status(400).json({ error: 'title required' });
            if (!board_id) return res.status(400).json({ error: 'board_id required' });

            const { data: existing } = await supabase
                .from('team_columns')
                .select('position')
                .eq('board_id', board_id)
                .order('position', { ascending: false })
                .limit(1);
            const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

            const { data, error } = await supabase
                .from('team_columns')
                .insert({ title, position: nextPos, board_id })
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

        // ── Set display name (self only) ──
        if (action === 'set-display-name') {
            const { display_name } = req.body;
            if (!display_name || !display_name.trim()) return res.status(400).json({ error: 'display_name required' });
            const cleaned = display_name.trim().slice(0, 32);

            const { data, error } = await supabase
                .from('team_members')
                .update({ display_name: cleaned })
                .eq('id', member.id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ member: data });
        }

        // ── Add channel (admin) ──
        if (action === 'add-channel') {
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
            const { title, board_id } = req.body;
            if (!title) return res.status(400).json({ error: 'title required' });
            if (!board_id) return res.status(400).json({ error: 'board_id required' });

            const { data: existing } = await supabase
                .from('team_channels')
                .select('position')
                .eq('board_id', board_id)
                .order('position', { ascending: false })
                .limit(1);
            const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

            const { data, error } = await supabase
                .from('team_channels')
                .insert({ title, position: nextPos, board_id })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ channel: data });
        }

        // ── Delete channel (admin) ──
        if (action === 'delete-channel') {
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
            const { channel_id } = req.body;
            if (!channel_id) return res.status(400).json({ error: 'channel_id required' });

            const { error } = await supabase
                .from('team_channels')
                .delete()
                .eq('id', channel_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Add board (admin) ──
        if (action === 'add-board') {
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
            const { title } = req.body;
            if (!title) return res.status(400).json({ error: 'title required' });

            const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (!slug) return res.status(400).json({ error: 'Invalid title for slug generation' });

            const { data: existing } = await supabase
                .from('team_boards')
                .select('position')
                .order('position', { ascending: false })
                .limit(1);
            const nextPos = (existing && existing.length > 0) ? existing[0].position + 1 : 0;

            const { data, error } = await supabase
                .from('team_boards')
                .insert({ title, slug, position: nextPos })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') return res.status(409).json({ error: 'Board slug already exists' });
                return res.status(500).json({ error: error.message });
            }
            return res.status(201).json({ board: data });
        }

        // ── Delete board (admin) ──
        if (action === 'delete-board') {
            if (!hasRole(member, 'admin')) return res.status(403).json({ error: 'Admin only' });
            const { board_id } = req.body;
            if (!board_id) return res.status(400).json({ error: 'board_id required' });

            // Delete channels' messages first, then channels, cards, columns, then board
            const { data: channels } = await supabase.from('team_channels').select('id').eq('board_id', board_id);
            if (channels && channels.length > 0) {
                const channelIds = channels.map(c => c.id);
                await supabase.from('team_messages').delete().in('channel_id', channelIds);
            }
            await supabase.from('team_channels').delete().eq('board_id', board_id);
            await supabase.from('team_calendar_events').delete().eq('board_id', board_id);
            await supabase.from('team_cards').delete().eq('board_id', board_id);
            await supabase.from('team_columns').delete().eq('board_id', board_id);

            const { error } = await supabase
                .from('team_boards')
                .delete()
                .eq('id', board_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
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

        // ── Add calendar event (member+) ──
        if (action === 'add-event') {
            if (!hasRole(member, 'member')) return res.status(403).json({ error: 'Members and above can create events' });
            const { board_id, title, description, event_date, event_time, category, assigned_to } = req.body;
            if (!board_id || !title || !event_date) return res.status(400).json({ error: 'board_id, title, event_date required' });

            const validCats = ['twitter', 'content', 'meeting', 'sermon', 'outreach', 'other'];
            const cat = validCats.includes(category) ? category : 'other';

            const { data, error } = await supabase
                .from('team_calendar_events')
                .insert({
                    board_id,
                    title,
                    description: description || null,
                    event_date,
                    event_time: event_time || null,
                    category: cat,
                    status: 'scheduled',
                    assigned_to: assigned_to || null,
                    created_by: member.id
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ event: data });
        }

        // ── Update calendar event (member own / editor+ any) ──
        if (action === 'update-event') {
            if (!hasRole(member, 'member')) return res.status(403).json({ error: 'Viewers cannot edit events' });
            const { event_id, title, description, event_date, event_time, category, status: evStatus, assigned_to } = req.body;
            if (!event_id) return res.status(400).json({ error: 'event_id required' });

            if (!hasRole(member, 'editor')) {
                const { data: ev } = await supabase.from('team_calendar_events').select('created_by').eq('id', event_id).single();
                if (!ev || ev.created_by !== member.id) {
                    return res.status(403).json({ error: 'Members can only edit their own events' });
                }
            }

            const validCats = ['twitter', 'content', 'meeting', 'sermon', 'outreach', 'other'];
            const validStatuses = ['scheduled', 'done', 'cancelled'];
            const updates = { updated_at: new Date().toISOString() };
            if (title !== undefined) updates.title = title;
            if (description !== undefined) updates.description = description;
            if (event_date !== undefined) updates.event_date = event_date;
            if (event_time !== undefined) updates.event_time = event_time || null;
            if (category !== undefined && validCats.includes(category)) updates.category = category;
            if (evStatus !== undefined && validStatuses.includes(evStatus)) updates.status = evStatus;
            if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;

            const { data, error } = await supabase
                .from('team_calendar_events')
                .update(updates)
                .eq('id', event_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ event: data });
        }

        // ── Delete calendar event (member own / editor+ any) ──
        if (action === 'delete-event') {
            if (!hasRole(member, 'member')) return res.status(403).json({ error: 'Viewers cannot delete events' });
            const { event_id } = req.body;
            if (!event_id) return res.status(400).json({ error: 'event_id required' });

            if (!hasRole(member, 'editor')) {
                const { data: ev } = await supabase.from('team_calendar_events').select('created_by').eq('id', event_id).single();
                if (!ev || ev.created_by !== member.id) {
                    return res.status(403).json({ error: 'Members can only delete their own events' });
                }
            }

            const { error } = await supabase
                .from('team_calendar_events')
                .delete()
                .eq('id', event_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
