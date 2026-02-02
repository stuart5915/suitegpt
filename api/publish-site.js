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
    process.env.SUPABASE_SERVICE_KEY
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    // POST — publish or update
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, slug, code, email, description, source, update } = req.body;

        // Validate required fields
        if (!slug || !code || !email) {
            return res.status(400).json({ error: 'Missing required fields: slug, code, email' });
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
                .select('id, publisher_email')
                .eq('slug', cleanSlug)
                .maybeSingle();

            if (!existing) {
                return res.status(404).json({ error: 'Site not found.' });
            }
            if (existing.publisher_email !== email) {
                return res.status(403).json({ error: 'You can only update your own site.' });
            }

            const { error: updateErr } = await supabase
                .from('user_apps')
                .update({
                    code,
                    name: name || cleanSlug,
                    description: description || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('slug', cleanSlug);

            if (updateErr) throw updateErr;

            return res.json({ success: true, url: `https://suitegpt.app/s/${cleanSlug}`, updated: true });
        }

        // NEW publish — check availability
        const available = await isSlugAvailable(cleanSlug);
        if (!available) {
            return res.status(409).json({ error: 'Subdomain already taken.', available: false });
        }

        // Insert
        const { error: insertErr } = await supabase
            .from('user_apps')
            .insert({
                name: name || cleanSlug,
                slug: cleanSlug,
                description: description || null,
                code,
                is_public: true,
                is_listed: false,
                publisher_email: email,
                source: source || 'clients-publish',
            });

        if (insertErr) throw insertErr;

        // Notify Stuart (fire-and-forget)
        fetch(`https://${req.headers.host || 'clients.suitegpt.app'}/api/notify-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name || cleanSlug,
                email,
                business_name: name,
                message: `Published site: https://suitegpt.app/s/${cleanSlug}`,
                source: (source || 'clients') + '-publish',
            }),
        }).catch(() => {});

        return res.json({ success: true, url: `https://suitegpt.app/s/${cleanSlug}` });

    } catch (err) {
        console.error('publish-site error:', err);
        return res.status(500).json({ error: 'Failed to publish. Please try again.' });
    }
}
