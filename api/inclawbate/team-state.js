// Inclawbate — Team State (read-only)
// GET → returns focus/active/backlog/done from team_state table

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    try {
        const [focusRes, activeRes, todoRes, doneRes] = await Promise.all([
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'current').order('created_at', { ascending: true }),
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'active').order('created_at', { ascending: true }),
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'todo').order('created_at', { ascending: true }),
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'done').order('created_at', { ascending: false }).limit(10)
        ]);

        const fmt = r => ({ id: r.id, content: r.content, author: r.author, date: r.created_at });

        return res.status(200).json({
            focus: (focusRes.data || []).map(fmt),
            active: (activeRes.data || []).map(fmt),
            backlog: (todoRes.data || []).map(fmt),
            done: (doneRes.data || []).map(fmt)
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
