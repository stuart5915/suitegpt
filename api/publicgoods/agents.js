// publicgoods.tech — Agents directory API
// GET: list agents (filterable)   POST: submit new agent
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
        let query = supabase.from('pgt_agents').select('*').eq('approved', true).order('featured', { ascending: false }).order('upvotes', { ascending: false }).order('created_at', { ascending: false });
        if (req.query.category && req.query.category !== 'all') query = query.eq('category', req.query.category);
        if (req.query.chain && req.query.chain !== 'all') query = query.eq('chain', req.query.chain);
        if (req.query.status && req.query.status !== 'all') query = query.eq('status', req.query.status);
        if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        query = query.limit(limit);
        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ agents: data || [] });
    }

    if (req.method === 'POST') {
        const { name, description, website, x_handle, telegram, github, chain, category, logo_url, token_address, token_symbol, submitted_by } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const { data, error } = await supabase.from('pgt_agents').insert({
            name, slug, description, website, x_handle, telegram, github, chain: chain || 'multi',
            category: category || 'general', logo_url, token_address, token_symbol,
            submitted_by, approved: false
        }).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, agent: data, message: 'Submitted for review' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
