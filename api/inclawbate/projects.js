// Inclawbate — Projects CRUD API
// GET  ?wallet=0x...  — list user's projects
// POST                — create project (JWT auth)
// PUT                 — update project (JWT auth, owner only)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500',
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);
}

async function uniqueSlug(base) {
    let slug = base;
    let suffix = 2;
    while (true) {
        const { data } = await supabase
            .from('projects')
            .select('id')
            .eq('slug', slug)
            .limit(1);
        if (!data || data.length === 0) return slug;
        slug = base + '-' + suffix;
        suffix++;
        if (suffix > 50) return base + '-' + Date.now();
    }
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET — list projects by wallet
    if (req.method === 'GET') {
        const wallet = (req.query.wallet || '').toLowerCase().trim();
        if (!wallet) return res.status(400).json({ error: 'wallet required' });

        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('creator_wallet', wallet)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ projects: data || [] });
    }

    // POST — create project
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, description, app_id, app_slug, token_address, staking_address, x_handle, telegram_url, website_url } = req.body || {};
        if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

        const wallet = (user.wallet_address || '').toLowerCase();
        if (!wallet) return res.status(400).json({ error: 'No wallet on profile' });

        const baseSlug = slugify(name.trim());
        if (!baseSlug) return res.status(400).json({ error: 'Invalid project name' });
        const slug = await uniqueSlug(baseSlug);

        const { data, error } = await supabase
            .from('projects')
            .insert({
                creator_wallet: wallet,
                creator_profile_id: user.profile_id || null,
                name: name.trim(),
                slug,
                description: description || null,
                app_id: app_id || null,
                app_slug: app_slug || null,
                token_address: token_address || null,
                staking_address: staking_address || null,
                x_handle: x_handle || null,
                telegram_url: telegram_url || null,
                website_url: website_url || null,
            })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ project: data });
    }

    // PUT — update project
    if (req.method === 'PUT') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { id, ...updates } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required' });

        const wallet = (user.wallet_address || '').toLowerCase();

        // Verify ownership
        const { data: existing } = await supabase
            .from('projects')
            .select('creator_wallet')
            .eq('id', id)
            .single();

        if (!existing || existing.creator_wallet !== wallet) {
            return res.status(403).json({ error: 'Not your project' });
        }

        // Only allow updating safe fields
        const allowed = ['name', 'description', 'app_id', 'app_slug', 'token_address', 'staking_address', 'x_handle', 'telegram_url', 'website_url', 'logo_url'];
        const patch = { updated_at: new Date().toISOString() };
        for (const key of allowed) {
            if (key in updates) patch[key] = updates[key] || null;
        }

        const { data, error } = await supabase
            .from('projects')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ project: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
