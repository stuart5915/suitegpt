// Inclawbate — Team State (read-only)
// GET → returns current past/present/future from team_state table

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    try {
        const [doneRes, currentRes, todoRes] = await Promise.all([
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'done').order('created_at', { ascending: false }).limit(10),
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'current').order('created_at', { ascending: true }),
            supabase.from('team_state').select('id, content, author, created_at').eq('category', 'todo').order('created_at', { ascending: true })
        ]);

        return res.status(200).json({
            past: (doneRes.data || []).map(r => ({ id: r.id, content: r.content, author: r.author, date: r.created_at })),
            present: (currentRes.data || []).map(r => ({ id: r.id, content: r.content, author: r.author, date: r.created_at })),
            future: (todoRes.data || []).map(r => ({ id: r.id, content: r.content, author: r.author, date: r.created_at }))
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
