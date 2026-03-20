// Inclawbate — Team State
// GET  → returns focus/incubations/responsibilities/backlog/done
// POST → add/remove/move items (admin key required)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    // GET — public read
    if (req.method === 'GET') {
        try {
            const [focusRes, incubationRes, responsibilityRes, todoRes, doneRes, campaignRes, expenseRes] = await Promise.all([
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'current').order('created_at', { ascending: true }),
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'incubation').order('created_at', { ascending: true }),
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'responsibility').order('created_at', { ascending: true }),
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'todo').order('created_at', { ascending: true }),
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'done').order('created_at', { ascending: false }).limit(10),
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'campaign').order('created_at', { ascending: true }),
                supabase.from('team_state').select('id, content, author, created_at').eq('category', 'expense').order('created_at', { ascending: true })
            ]);

            const fmt = r => ({ id: r.id, content: r.content, author: r.author, date: r.created_at });

            return res.status(200).json({
                focus: (focusRes.data || []).map(fmt),
                incubations: (incubationRes.data || []).map(fmt),
                responsibilities: (responsibilityRes.data || []).map(fmt),
                backlog: (todoRes.data || []).map(fmt),
                done: (doneRes.data || []).map(fmt),
                campaigns: (campaignRes.data || []).map(fmt),
                expenses: (expenseRes.data || []).map(fmt)
            });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // POST — admin write
    if (req.method === 'POST') {
        const auth = req.headers.authorization?.replace('Bearer ', '');
        if (auth !== ADMIN_KEY) return res.status(403).json({ error: 'unauthorized' });

        const { action, id, category, content, author } = req.body || {};

        try {
            if (action === 'add') {
                const { error } = await supabase.from('team_state').insert({ category, content, author: author || 'admin' });
                if (error) return res.status(400).json({ error: error.message });
                return res.status(200).json({ ok: true, action: 'added' });
            }

            if (action === 'remove') {
                if (id) {
                    await supabase.from('team_state').delete().eq('id', id);
                } else if (content && category) {
                    await supabase.from('team_state').delete().eq('category', category).ilike('content', `%${content}%`);
                }
                return res.status(200).json({ ok: true, action: 'removed' });
            }

            if (action === 'move') {
                if (!id || !category) return res.status(400).json({ error: 'id and category required' });
                await supabase.from('team_state').update({ category }).eq('id', id);
                return res.status(200).json({ ok: true, action: 'moved' });
            }

            if (action === 'clear') {
                if (!category) return res.status(400).json({ error: 'category required' });
                await supabase.from('team_state').delete().eq('category', category);
                return res.status(200).json({ ok: true, action: 'cleared' });
            }

            return res.status(400).json({ error: 'action must be add/remove/move/clear' });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'GET or POST only' });
}
