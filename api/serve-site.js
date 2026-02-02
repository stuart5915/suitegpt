// Wildcard subdomain handler — serves published sites from Supabase user_apps table
// Requested via [name].suitegpt.app → vercel.json rewrite → this function

import { createClient } from '@supabase/supabase-js';

const RESERVED = new Set([
    'clients', 'portfolio', 'www', 'api', 'admin', 'app', 'mail', 'ftp',
    'staging', 'dev', 'test', 'suitegpt', 'suite',
    'trueform', 'opticrep', 'cheshbon', 'remcast-app',
]);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

function getSubdomain(host) {
    if (!host) return null;
    // Remove port if present
    host = host.split(':')[0];
    // Extract subdomain from [name].suitegpt.app
    const match = host.match(/^([a-z0-9][a-z0-9-]{0,61}[a-z0-9]?)\.suitegpt\.app$/i);
    return match ? match[1].toLowerCase() : null;
}

function notFoundPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Site Not Found</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, system-ui, sans-serif; background: #faf8f4; display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #1a1a1a; }
.c { text-align: center; padding: 40px 24px; }
h1 { font-size: 2rem; margin-bottom: 8px; }
p { color: #555; margin-bottom: 24px; }
a { display: inline-block; padding: 12px 28px; background: #0f0f0f; color: #fff; border-radius: 12px; text-decoration: none; font-weight: 600; transition: background 0.2s; }
a:hover { background: #e8613a; }
</style>
</head>
<body>
<div class="c">
<h1>Site not found</h1>
<p>This subdomain hasn't been published yet.</p>
<a href="https://clients.suitegpt.app">Build your own site</a>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).end();
    }

    const subdomain = getSubdomain(req.headers.host);

    if (!subdomain || RESERVED.has(subdomain)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(notFoundPage());
    }

    try {
        const { data, error } = await supabase
            .from('user_apps')
            .select('code')
            .eq('slug', subdomain)
            .eq('is_public', true)
            .single();

        if (error || !data || !data.code) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(404).send(notFoundPage());
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        // Don't set X-Frame-Options so sites can be embedded
        return res.status(200).send(data.code);

    } catch (err) {
        console.error('serve-site error:', err);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(500).send(notFoundPage());
    }
}
