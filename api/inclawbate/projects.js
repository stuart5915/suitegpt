// Inclawbate — Projects CRUD API
// GET  ?wallet=0x...  — list user's projects
// POST                — create project (JWT auth)
// PUT                 — update project (JWT auth, owner only)
// PATCH               — update agent settings (JWT auth, owner only)

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

function sanitizeProject(p) {
    if (!p) return p;
    const { x_access_token, x_refresh_token, ...safe } = p;
    safe.x_connected = !!(x_access_token && x_refresh_token);
    return safe;
}

function sanitizeProjects(rows) {
    return (rows || []).map(sanitizeProject);
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET — public: single project by slug
    if (req.method === 'GET' && req.query.slug) {
        const slug = req.query.slug.toLowerCase().trim();
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error || !data) return res.status(404).json({ error: 'Project not found' });
        return res.status(200).json({ project: sanitizeProject(data) });
    }

    // GET — public: list all projects
    if (req.method === 'GET' && req.query.public === '1') {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ projects: sanitizeProjects(data) });
    }

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
        return res.status(200).json({ projects: sanitizeProjects(data) });
    }

    // POST — create project
    if (req.method === 'POST') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { name, description, long_description, app_id, app_slug, token_address, token_symbol, staking_address, x_handle, telegram_url, website_url, logo_url, agent_enabled, agent_persona, agent_posts_per_day, agent_status } = req.body || {};
        if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

        const wallet = (user.wallet_address || '').toLowerCase();
        if (!wallet) return res.status(400).json({ error: 'No wallet on profile' });

        const baseSlug = slugify(name.trim());
        if (!baseSlug) return res.status(400).json({ error: 'Invalid project name' });
        const slug = await uniqueSlug(baseSlug);

        const row = {
            creator_wallet: wallet,
            creator_profile_id: user.profile_id || null,
            name: name.trim(),
            slug,
            description: description || null,
            app_id: app_id || null,
            app_slug: app_slug || null,
            token_address: token_address || null,
            token_symbol: token_symbol || null,
            staking_address: staking_address || null,
            x_handle: x_handle || null,
            telegram_url: telegram_url || null,
            website_url: website_url || null,
            long_description: long_description || null,
            logo_url: logo_url || null,
        };

        // Agent fields (optional)
        if (typeof agent_enabled === 'boolean') row.agent_enabled = agent_enabled;
        if (agent_persona) row.agent_persona = agent_persona;
        if (agent_posts_per_day !== undefined) {
            row.agent_posts_per_day = Math.max(1, Math.min(3, parseInt(agent_posts_per_day) || 2));
        }
        if (agent_status && ['active', 'dormant', 'paused'].includes(agent_status)) {
            row.agent_status = agent_status;
        }

        const { data, error } = await supabase
            .from('projects')
            .insert(row)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json({ project: sanitizeProject(data) });
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
        const allowed = ['name', 'description', 'long_description', 'app_id', 'app_slug', 'token_address', 'token_symbol', 'staking_address', 'x_handle', 'telegram_url', 'website_url', 'logo_url', 'marketing_plan'];
        const patch = { updated_at: new Date().toISOString() };
        for (const key of allowed) {
            if (key in updates) patch[key] = updates[key] || null;
        }
        // Auto-set marketing_plan_generated_at when plan is saved
        if ('marketing_plan' in updates && updates.marketing_plan) {
            patch.marketing_plan_generated_at = new Date().toISOString();
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

    // PATCH — update agent settings (owner only)
    if (req.method === 'PATCH') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { id, agent_enabled, agent_persona, agent_posts_per_day, agent_status, agent_bid, token_symbol } = req.body || {};
        if (!id) return res.status(400).json({ error: 'id is required' });

        const wallet = (user.wallet_address || '').toLowerCase();

        // Verify ownership (check wallet or profile ID)
        const { data: existing } = await supabase
            .from('projects')
            .select('creator_wallet, creator_profile_id, agent_enabled')
            .eq('id', id)
            .single();

        if (!existing) return res.status(404).json({ error: 'Project not found' });
        const patchOwner = existing.creator_wallet === wallet ||
            existing.creator_profile_id === user.sub;
        if (!patchOwner) {
            return res.status(403).json({ error: 'Not your project' });
        }

        const patch = { updated_at: new Date().toISOString() };

        if (typeof agent_enabled === 'boolean') patch.agent_enabled = agent_enabled;
        if (agent_persona !== undefined) patch.agent_persona = agent_persona || null;
        if (agent_posts_per_day !== undefined) {
            const ppd = Math.max(1, Math.min(3, parseInt(agent_posts_per_day) || 2));
            patch.agent_posts_per_day = ppd;
        }
        if (agent_status && ['active', 'dormant', 'paused'].includes(agent_status)) {
            patch.agent_status = agent_status;
        }
        if (agent_bid !== undefined) {
            patch.agent_bid = Math.max(0, parseInt(agent_bid) || 0);
        }
        if (token_symbol !== undefined) {
            patch.token_symbol = token_symbol || null;
        }

        const { data, error } = await supabase
            .from('projects')
            .update(patch)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ project: sanitizeProject(data) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
