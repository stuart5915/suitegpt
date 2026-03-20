// Admin — Bulk update X handles across all tables
// POST { old_handle, new_handle } → updates user_apps, human_profiles, projects, inclawbator_projects
// Admin-only (super admin wallet required)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

const ALLOWED_ORIGINS = [
    'https://inclawbate.app', 'https://www.inclawbate.app',
    'https://inclawbate.app', 'https://www.inclawbate.app',
    'http://localhost:3000', 'http://localhost:5500',
];

function authenticateAdmin(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const wallet = (payload.wallet_address || payload.sub || '').toLowerCase();
        if (wallet === SUPER_ADMIN) return wallet;
    } catch(e) {}
    return null;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const admin = authenticateAdmin(req);
    if (!admin) return res.status(403).json({ error: 'Admin only' });

    const { old_handle, new_handle } = req.body || {};
    if (!old_handle || !new_handle) {
        return res.status(400).json({ error: 'old_handle and new_handle required' });
    }

    const clean_old = old_handle.replace(/^@/, '').trim();
    const clean_new = new_handle.replace(/^@/, '').trim();
    if (!clean_old || !clean_new) {
        return res.status(400).json({ error: 'Invalid handles' });
    }

    const results = {};

    // 1. user_apps.creator_x_handle
    const { data: apps, error: e1 } = await supabase
        .from('user_apps')
        .update({ creator_x_handle: clean_new })
        .ilike('creator_x_handle', clean_old)
        .select('id');
    results.user_apps = apps?.length || 0;
    if (e1) results.user_apps_error = e1.message;

    // 2. human_profiles.x_handle
    const { data: profiles, error: e2 } = await supabase
        .from('human_profiles')
        .update({ x_handle: clean_new })
        .ilike('x_handle', clean_old)
        .select('id');
    results.human_profiles = profiles?.length || 0;
    if (e2) results.human_profiles_error = e2.message;

    // 3. projects.x_handle
    const { data: projects, error: e3 } = await supabase
        .from('projects')
        .update({ x_handle: clean_new })
        .ilike('x_handle', clean_old)
        .select('id');
    results.projects = projects?.length || 0;
    if (e3) results.projects_error = e3.message;

    // 4. inclawbator_projects.x_handle
    const { data: iprojects, error: e4 } = await supabase
        .from('inclawbator_projects')
        .update({ x_handle: clean_new })
        .ilike('x_handle', clean_old)
        .select('id');
    results.inclawbator_projects = iprojects?.length || 0;
    if (e4) results.inclawbator_projects_error = e4.message;

    // 5. inclawbate_ubi_contributions.x_handle
    const { data: ubi, error: e5 } = await supabase
        .from('inclawbate_ubi_contributions')
        .update({ x_handle: clean_new })
        .ilike('x_handle', clean_old)
        .select('id');
    results.ubi_contributions = ubi?.length || 0;
    if (e5) results.ubi_error = e5.message;

    const total = results.user_apps + results.human_profiles + results.projects
        + results.inclawbator_projects + results.ubi_contributions;

    return res.json({
        ok: true,
        old_handle: clean_old,
        new_handle: clean_new,
        total_updated: total,
        details: results
    });
}
