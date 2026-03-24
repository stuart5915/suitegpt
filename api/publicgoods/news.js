// publicgoods.tech — Curated News Feed API
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        let query = supabase.from('pgt_news').select('*').order('created_at', { ascending: false });
        if (req.query.category && req.query.category !== 'all') query = query.eq('category', req.query.category);
        const { data, error } = await query.limit(30);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ news: data || [] });
    }

    if (req.method === 'POST') {
        const { title, url, summary, source, source_handle, category, tags, submitted_by } = req.body;
        if (!title || !url) return res.status(400).json({ error: 'title and url required' });
        const { data, error } = await supabase.from('pgt_news').insert({
            title, url, summary, source, source_handle,
            category: category || 'news', tags: tags || [],
            submitted_by
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, item: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
