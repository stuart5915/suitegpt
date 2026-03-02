// App Store API — list apps (GET) + upvote toggle (POST)

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET = process.env.INCLAWBATE_JWT_SECRET;

function verifyJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const expectedSig = createHmac('sha256', JWT_SECRET)
            .update(`${parts[0]}.${parts[1]}`)
            .digest('base64url');
        if (parts[2] !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
        return payload;
    } catch { return null; }
}

function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    return verifyJwt(auth.replace('Bearer ', ''));
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET — list apps ──
    if (req.method === 'GET') {
        try {
            const { category, search, sort, page, limit: rawLimit, id } = req.query;
            const user = getUser(req);

            // Single app detail
            if (id) {
                const { data: app, error } = await supabase
                    .from('user_apps')
                    .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, is_public, is_listed, created_at, updated_at')
                    .eq('id', id)
                    .maybeSingle();

                if (error || !app) return res.status(404).json({ error: 'App not found' });

                let has_upvoted = false;
                if (user) {
                    const { data: uv } = await supabase
                        .from('app_upvotes')
                        .select('id')
                        .eq('profile_id', user.sub)
                        .eq('app_id', id)
                        .maybeSingle();
                    has_upvoted = !!uv;
                }

                return res.json({ app: { ...app, has_upvoted } });
            }

            // List apps
            const pageNum = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(50, Math.max(1, parseInt(rawLimit) || 20));
            const offset = (pageNum - 1) * limitNum;

            let query = supabase
                .from('user_apps')
                .select('id, name, slug, description, category, claws_price, creator_wallet, creator_x_handle, tags, upvote_count, created_at', { count: 'exact' })
                .eq('is_listed', true)
                .eq('is_public', true);

            if (category && category !== 'all') {
                query = query.eq('category', category);
            }

            if (search) {
                query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
            }

            // Sort
            if (sort === 'newest') {
                query = query.order('created_at', { ascending: false });
            } else if (sort === 'popular') {
                query = query.order('upvote_count', { ascending: false });
            } else {
                // trending: upvotes weighted by recency (simple: order by upvotes then date)
                query = query.order('upvote_count', { ascending: false }).order('created_at', { ascending: false });
            }

            query = query.range(offset, offset + limitNum - 1);

            const { data: apps, error, count } = await query;
            if (error) throw error;

            // Check upvotes for authenticated user
            let upvotedSet = new Set();
            if (user && apps.length > 0) {
                const appIds = apps.map(a => a.id);
                const { data: uvs } = await supabase
                    .from('app_upvotes')
                    .select('app_id')
                    .eq('profile_id', user.sub)
                    .in('app_id', appIds);
                if (uvs) uvs.forEach(u => upvotedSet.add(u.app_id));
            }

            const results = apps.map(a => ({
                ...a,
                has_upvoted: upvotedSet.has(a.id)
            }));

            return res.json({
                apps: results,
                total: count,
                page: pageNum,
                pages: Math.ceil((count || 0) / limitNum)
            });

        } catch (err) {
            console.error('apps list error:', err);
            return res.status(500).json({ error: 'Failed to load apps' });
        }
    }

    // ── POST — upvote toggle ──
    if (req.method === 'POST') {
        const user = getUser(req);
        if (!user) return res.status(401).json({ error: 'Login required' });

        try {
            const { action, app_id } = req.body;
            if (action !== 'upvote' || !app_id) {
                return res.status(400).json({ error: 'Invalid action' });
            }

            // Check if already upvoted
            const { data: existing } = await supabase
                .from('app_upvotes')
                .select('id')
                .eq('profile_id', user.sub)
                .eq('app_id', app_id)
                .maybeSingle();

            if (existing) {
                // Remove upvote
                await supabase.from('app_upvotes').delete().eq('id', existing.id);
                await supabase.rpc('increment_field', { table_name: 'user_apps', row_id: app_id, field_name: 'upvote_count', amount: -1 }).catch(() => {});
                // Fallback: manual decrement
                const { data: app } = await supabase.from('user_apps').select('upvote_count').eq('id', app_id).maybeSingle();
                if (app) {
                    const newCount = Math.max(0, (app.upvote_count || 0) - 1);
                    await supabase.from('user_apps').update({ upvote_count: newCount }).eq('id', app_id);
                    return res.json({ upvoted: false, upvote_count: newCount });
                }
                return res.json({ upvoted: false });
            } else {
                // Add upvote
                const { error: insErr } = await supabase.from('app_upvotes').insert({
                    profile_id: user.sub,
                    app_id
                });
                if (insErr) throw insErr;

                const { data: app } = await supabase.from('user_apps').select('upvote_count').eq('id', app_id).maybeSingle();
                if (app) {
                    const newCount = (app.upvote_count || 0) + 1;
                    await supabase.from('user_apps').update({ upvote_count: newCount }).eq('id', app_id);
                    return res.json({ upvoted: true, upvote_count: newCount });
                }
                return res.json({ upvoted: true });
            }

        } catch (err) {
            console.error('upvote error:', err);
            return res.status(500).json({ error: 'Failed to process upvote' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
