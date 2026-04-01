// Publish site API — saves generated HTML to user_apps and makes it live at [slug].suitegpt.app
// GET ?check=slug-name  → { available: true/false }
// POST { name, slug, code, email, description, source, update } → { success, url }

import { createClient } from '@supabase/supabase-js';

const RESERVED = new Set([
    'clients', 'portfolio', 'www', 'api', 'admin', 'app', 'mail', 'ftp',
    'staging', 'dev', 'test', 'suitegpt', 'suite',
    'trueform', 'opticrep', 'cheshbon', 'remcast-app',
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?$/;
const MAX_CODE_SIZE = 512 * 1024; // 500KB

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function isSlugAvailable(slug) {
    if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) return false;
    const { data } = await supabase
        .from('user_apps')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
    return !data;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — slug availability check
    if (req.method === 'GET') {
        const slug = (req.query.check || '').toLowerCase().trim();
        if (!slug) return res.status(400).json({ error: 'Missing ?check= parameter' });
        if (RESERVED.has(slug)) return res.json({ available: false, reason: 'reserved' });
        if (!SLUG_RE.test(slug)) return res.json({ available: false, reason: 'invalid' });
        const available = await isSlugAvailable(slug);
        return res.json({ available });
    }

    // DELETE — remove published app
    if (req.method === 'DELETE') {
        try {
            const { slug, email, wallet } = req.body || {};
            if (!slug) {
                return res.status(400).json({ error: 'Missing required field: slug' });
            }
            const cleanSlug = slug.toLowerCase().trim();
            const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
            const { data: existing } = await supabase
                .from('user_apps')
                .select('id, publisher_email, creator_wallet')
                .eq('slug', cleanSlug)
                .maybeSingle();
            if (!existing) {
                return res.status(404).json({ error: 'App not found.' });
            }
            const walletLower = (wallet || '').toLowerCase();
            const isAdmin = walletLower === SUPER_ADMIN;
            const emailMatch = email && existing.publisher_email === email;
            const walletMatch = walletLower && existing.creator_wallet && existing.creator_wallet.toLowerCase() === walletLower;
            if (!isAdmin && !emailMatch && !walletMatch) {
                return res.status(403).json({ error: 'You can only delete your own app.' });
            }
            const { error: delErr } = await supabase
                .from('user_apps')
                .delete()
                .eq('slug', cleanSlug);
            if (delErr) throw delErr;
            return res.json({ success: true, deleted: true });
        } catch (err) {
            console.error('publish-site DELETE error:', err);
            return res.status(500).json({ error: 'Failed to delete: ' + (err?.message || String(err)) });
        }
    }

    // POST — publish or update
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, slug, code, email, description, source, update,
                category, claws_price, creator_wallet, creator_x_handle, tags, is_listed, featured,
                forked_from_user_app, revenue_split, user_id } = req.body;

        // Validate required fields
        if (!slug || !code) {
            return res.status(400).json({ error: 'Missing required fields: slug, code' });
        }

        // If no email provided, check if anonymous publishing is allowed
        const publishEmail = email || 'anonymous@inclawbate.app';
        if (!email) {
            const { data: setting } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'allow_anonymous_publish')
                .maybeSingle();
            if (setting && setting.value === 'false') {
                return res.status(403).json({ error: 'Anonymous publishing is currently disabled. Please log in to publish.' });
            }
        }

        const cleanSlug = slug.toLowerCase().trim();

        // Validate slug format
        if (!SLUG_RE.test(cleanSlug)) {
            return res.status(400).json({ error: 'Invalid subdomain. Use lowercase letters, numbers, and hyphens.' });
        }

        // Check reserved
        if (RESERVED.has(cleanSlug)) {
            return res.status(400).json({ error: 'This subdomain is reserved.' });
        }

        // Check code size
        if (code.length > MAX_CODE_SIZE) {
            return res.status(400).json({ error: 'Site is too large (max 500KB).' });
        }

        // Validate HTML
        if (!code.includes('<!DOCTYPE') && !code.includes('<!doctype')) {
            return res.status(400).json({ error: 'Invalid HTML.' });
        }

        // UPDATE existing site
        if (update) {
            const { data: existing } = await supabase
                .from('user_apps')
                .select('id, publisher_email, creator_wallet')
                .eq('slug', cleanSlug)
                .maybeSingle();

            if (!existing) {
                return res.status(404).json({ error: 'Site not found.' });
            }
            // Allow updates from the original publisher
            // For inclawbator agent: only allow if same creator_wallet or app has no wallet set
            if (publishEmail === 'inclawbator@inclawbate.app') {
                if (existing.creator_wallet && creator_wallet && existing.creator_wallet.toLowerCase() !== creator_wallet.toLowerCase()) {
                    return res.status(403).json({ error: 'You can only update your own apps.' });
                }
            } else if (existing.publisher_email !== publishEmail) {
                return res.status(403).json({ error: 'You can only update your own site.' });
            }

            const updatePayload = {
                code,
                name: name || cleanSlug,
                description: description || null,
                updated_at: new Date().toISOString(),
            };
            if (category) updatePayload.category = category;
            if (claws_price !== undefined) updatePayload.claws_price = claws_price;
            if (creator_wallet) updatePayload.creator_wallet = creator_wallet;
            if (creator_x_handle) updatePayload.creator_x_handle = creator_x_handle;
            if (tags) updatePayload.tags = tags;
            if (is_listed !== undefined) updatePayload.is_listed = is_listed;
            if (featured !== undefined) updatePayload.featured = featured;
            if (user_id) updatePayload.user_id = user_id;

            let { error: updateErr } = await supabase
                .from('user_apps')
                .update(updatePayload)
                .eq('slug', cleanSlug);

            // If user_id FK fails, retry without it
            if (updateErr && updateErr.code === '23503' && updatePayload.user_id) {
                delete updatePayload.user_id;
                const retry = await supabase.from('user_apps').update(updatePayload).eq('slug', cleanSlug);
                updateErr = retry.error;
            }

            if (updateErr) throw updateErr;

            return res.json({ success: true, url: `https://inclawbate.app/s/${cleanSlug}`, updated: true });
        }

        // NEW publish — check availability
        const available = await isSlugAvailable(cleanSlug);
        if (!available) {
            return res.status(409).json({ error: 'Subdomain already taken.', available: false });
        }

        // Insert
        const VALID_CATEGORIES = ['tools', 'games', 'creative', 'finance', 'social', 'other'];
        const insertPayload = {
            name: name || cleanSlug,
            slug: cleanSlug,
            description: description || null,
            code,
            is_public: true,
            is_listed: is_listed === true,
            publisher_email: publishEmail,
            source: source || 'clients-publish',
            category: VALID_CATEGORIES.includes(category) ? category : 'other',
            claws_price: parseFloat(claws_price) || 0,
            creator_wallet: creator_wallet || null,
            creator_x_handle: creator_x_handle || null,
            tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
            upvote_count: 0,
            forked_from_user_app: forked_from_user_app || null,
            revenue_split: forked_from_user_app ? (parseInt(revenue_split) || 80) : 100,
            user_id: user_id || null,
        };

        let { error: insertErr } = await supabase
            .from('user_apps')
            .insert(insertPayload);

        // If user_id FK fails, retry without it
        if (insertErr && insertErr.code === '23503' && insertPayload.user_id) {
            insertPayload.user_id = null;
            const retry = await supabase.from('user_apps').insert(insertPayload);
            insertErr = retry.error;
        }

        if (insertErr) throw insertErr;

        // Notify Stuart (fire-and-forget)
        fetch(`https://${req.headers.host || 'clients.suitegpt.app'}/api/notify-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name || cleanSlug,
                email: publishEmail,
                business_name: name,
                message: `Published site: https://inclawbate.app/s/${cleanSlug}`,
                source: (source || 'clients') + '-publish',
            }),
        }).catch(() => {});

        return res.json({ success: true, url: `https://inclawbate.app/s/${cleanSlug}` });

    } catch (err) {
        console.error('publish-site error:', err);
        const detail = err?.message || err?.details || String(err);
        return res.status(500).json({ error: 'Failed to publish: ' + detail });
    }
}
