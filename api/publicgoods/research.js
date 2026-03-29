// publicgoods.tech — Research Database API (admin only)
// CRUD for agents, builders, goods + mention tracking
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ADMIN_WALLETS = [
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd', // Stuart
    '0x47fbb4e2527492ab56b7fba5fde3e7b35719e655', // FreefoRaLLey
];

function isAdmin(wallet) {
    return ADMIN_WALLETS.includes((wallet || '').toLowerCase());
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const wallet = (req.query.wallet || req.body?.wallet || '').toLowerCase();
    if (!isAdmin(wallet)) return res.status(403).json({ error: 'Admin only' });

    const type = req.query.type || req.body?.type; // 'agents', 'goods', 'builders', 'protocols', 'apps', 'platforms', 'pending'
    const table = type === 'goods' ? 'pgt_public_goods' : type === 'builders' ? 'pgt_builders' : type === 'protocols' ? 'pgt_protocols' : type === 'apps' ? 'pgt_apps' : type === 'platforms' ? 'inclawbator_platforms' : 'pgt_agents';

    // GET — list all (including unapproved, for admin)
    if (req.method === 'GET') {
        // Pending: fetch unapproved from ALL tables
        if (type === 'pending') {
            const tables = [
                { table: 'pgt_agents', type: 'agents' },
                { table: 'pgt_public_goods', type: 'goods' },
                { table: 'pgt_builders', type: 'builders' },
                { table: 'pgt_protocols', type: 'protocols' },
                { table: 'pgt_apps', type: 'apps' },
            ];
            const all = [];
            for (const t of tables) {
                const { data } = await supabase.from(t.table).select('*').eq('approved', false).order('created_at', { ascending: false }).limit(50);
                if (data) all.push(...data.map(d => ({ ...d, _table: t.table, _type: t.type })));
            }
            all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return res.json({ items: all, type: 'pending', count: all.length });
        }

        let query = supabase.from(table).select('*').order('last_mentioned', { ascending: true, nullsFirst: true }).order('mentions_count', { ascending: true });
        if (req.query.search) query = query.ilike('name', `%${req.query.search}%`);
        const { data, error } = await query.limit(200);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ items: data || [], type });
    }

    // POST — add new entry
    if (req.method === 'POST') {
        const { name, description, website, x_handle, github, telegram, chain, category, status, logo_url, token_address, token_symbol, bio, skills, projects, notes } = req.body;
        if (!name) return res.status(400).json({ error: 'name required' });
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Auto-generate logo from X handle if not provided
        const autoLogo = logo_url || (x_handle ? `https://unavatar.io/x/${(x_handle || '').replace('@','')}` : null);

        let row = { name, slug, x_handle, github, notes, approved: true };
        if (type === 'builders') {
            Object.assign(row, { bio: bio || description, website, skills: skills || [], projects: projects || [], wallet_address: wallet, avatar_url: autoLogo });
        } else {
            row.description = description;
            row.website = website;
            row.category = category;
        }
        if (type === 'platforms') Object.assign(row, { listing_url: req.body.listing_url, status: status || 'discovered', logo_url: autoLogo, submitted_by: wallet });
        if (type === 'agents') Object.assign(row, { telegram, chain: chain || 'multi', status: status || 'live', logo_url: autoLogo, token_address, token_symbol, submitted_by: wallet });
        if (type === 'goods') Object.assign(row, { chain, logo_url: autoLogo, submitted_by: wallet });
        if (type === 'protocols') Object.assign(row, { chain, logo_url: autoLogo, token_symbol, submitted_by: wallet });
        if (type === 'apps') Object.assign(row, { url: website, logo_url: autoLogo, submitted_by: wallet });

        const { data, error } = await supabase.from(table).insert(row).select().single();
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, item: data });
    }

    // PUT — update entry or record mention
    if (req.method === 'PUT') {
        const { id, action, _table: overrideTable } = req.body;
        if (!id) return res.status(400).json({ error: 'id required' });
        // Allow override table for pending items (which come from mixed tables)
        const targetTable = overrideTable || table;

        // Record a mention
        if (action === 'mention') {
            const { data: current } = await supabase.from(targetTable).select('mentions_count').eq('id', id).single();
            const { error } = await supabase.from(targetTable).update({
                mentions_count: (current?.mentions_count || 0) + 1,
                last_mentioned: new Date().toISOString()
            }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true, action: 'mentioned' });
        }

        // Toggle approved
        if (action === 'approve') {
            const { data: current } = await supabase.from(targetTable).select('approved').eq('id', id).single();
            const { error } = await supabase.from(targetTable).update({ approved: !current?.approved }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true, approved: !current?.approved });
        }

        // Toggle featured
        if (action === 'feature') {
            const { data: current } = await supabase.from(targetTable).select('featured').eq('id', id).single();
            const { error } = await supabase.from(targetTable).update({ featured: !current?.featured }).eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.json({ ok: true, featured: !current?.featured });
        }

        // General update
        const updates = {};
        for (const key of ['name', 'description', 'website', 'x_handle', 'github', 'telegram', 'chain', 'category', 'status', 'notes', 'bio', 'skills', 'projects', 'logo_url', 'token_address', 'token_symbol', 'listing_url']) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });
        const { error } = await supabase.from(targetTable).update(updates).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
    }

    // DELETE
    if (req.method === 'DELETE') {
        const { id, _table: delTable } = req.body;
        if (!id) return res.status(400).json({ error: 'id required' });
        const { error } = await supabase.from(delTable || table).delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
