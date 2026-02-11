// Inclawbate — Profile SSR for dynamic OG tags
// Serves profile.html with the user's name/tagline injected into meta tags
// so link previews on Twitter/Discord/etc show the actual person

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

let templateCache = null;
function getTemplate() {
    if (!templateCache) {
        templateCache = readFileSync(join(process.cwd(), 'inclawbate', 'profile.html'), 'utf8');
    }
    return templateCache;
}

function esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(req, res) {
    const handle = (req.query.handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

    let html = getTemplate();

    if (!handle) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    }

    // Fetch profile for OG tags
    try {
        const { data } = await supabase
            .from('human_profiles')
            .select('x_handle, x_name, tagline, bio, skills, x_avatar_url')
            .eq('x_handle', handle)
            .single();

        if (data) {
            const name = data.x_name || data.x_handle;
            const desc = data.tagline || data.bio || `${name} on Inclawbate — hireable by AI agents`;
            const skills = (data.skills || []).slice(0, 3).join(', ');
            const ogImageUrl = `https://inclawbate.com/api/inclawbate/og?handle=${encodeURIComponent(data.x_handle)}&name=${encodeURIComponent(name)}`;
            const profileUrl = `https://inclawbate.com/u/${encodeURIComponent(data.x_handle)}`;

            // Replace OG tags
            html = html
                .replace(
                    /<title>[^<]*<\/title>/,
                    `<title>${esc(name)} — Inclawbate</title>`
                )
                .replace(
                    /<meta name="description" content="[^"]*">/,
                    `<meta name="description" content="${esc(desc)}">`
                )
                .replace(
                    /<meta property="og:title" content="[^"]*">/,
                    `<meta property="og:title" content="${esc(name)} — Inclawbate">`
                )
                .replace(
                    /<meta property="og:description" content="[^"]*">/,
                    `<meta property="og:description" content="${esc(desc)}">`
                )
                .replace(
                    /<meta property="og:url" content="[^"]*">/,
                    `<meta property="og:url" content="${profileUrl}">`
                )
                .replace(
                    /<meta property="og:image" content="[^"]*">/,
                    `<meta property="og:image" content="${ogImageUrl}">`
                )
                .replace(
                    /<meta name="twitter:title" content="[^"]*">/,
                    `<meta name="twitter:title" content="${esc(name)} — Inclawbate">`
                )
                .replace(
                    /<meta name="twitter:description" content="[^"]*">/,
                    `<meta name="twitter:description" content="${esc(desc)}">`
                )
                .replace(
                    /<meta name="twitter:image" content="[^"]*">/,
                    `<meta name="twitter:image" content="${ogImageUrl}">`
                );
        }
    } catch (err) {
        // If Supabase fails, serve generic page — still better than nothing
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
}
