// publicgoods.tech — Builders/Vibecoders directory API
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
        let query = supabase.from('pgt_builders').select('*').eq('approved', true).order('featured', { ascending: false }).order('upvotes', { ascending: false }).order('created_at', { ascending: false });
        if (req.query.skill) query = query.contains('skills', [req.query.skill]);
        if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);
        const { data, error } = await query.limit(50);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ builders: data || [] });
    }

    if (req.method === 'POST') {
        const { name, bio, x_handle, github, website, wallet_address, skills, projects, avatar_url } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data, error } = await supabase.from('pgt_builders').insert({
            name, slug, bio, x_handle, github, website, wallet_address, skills: skills || [], projects: projects || [], avatar_url, approved: false
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, builder: data, message: 'Submitted for review' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
