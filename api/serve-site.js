// Path-based site handler — serves published sites from Supabase user_apps table
// Requested via suitegpt.app/s/[slug] → vercel.json rewrite → this function?slug=[slug]

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?$/;
const JWT_SECRET = process.env.INCLAWBATE_JWT_SECRET;

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function getUserFromCookie(req) {
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/inclawbate_token=([^;]+)/);
    if (!match) return null;
    return verifyJwt(decodeURIComponent(match[1]));
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
<p>This site hasn't been published yet.</p>
<a href="https://clients.suitegpt.app">Build your own site</a>
</div>
</body>
</html>`;
}

function paywallPage(app) {
    const name = app.name || app.slug;
    const price = parseFloat(app.claws_price) || 0;
    const creator = app.creator_x_handle ? '@' + app.creator_x_handle : (app.creator_wallet ? app.creator_wallet.slice(0, 6) + '...' + app.creator_wallet.slice(-4) : 'Creator');
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name} — Unlock with CLAWS</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Nunito', system-ui, sans-serif; background: #06060b; color: #e8e0d8; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
.c { text-align: center; padding: 40px 24px; max-width: 420px; }
.lock { font-size: 3rem; margin-bottom: 16px; }
h1 { font-size: 1.6rem; margin-bottom: 8px; }
.desc { color: #8a8078; margin-bottom: 24px; line-height: 1.5; }
.price { display: inline-block; padding: 8px 20px; background: hsla(32, 40%, 30%, 0.3); color: #c9a86c; border-radius: 999px; font-size: 1rem; font-weight: 700; margin-bottom: 24px; }
.creator { color: #6a6058; font-size: 0.85rem; margin-bottom: 24px; }
a { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #c05a3c, #d4845a); color: #fff; border-radius: 12px; text-decoration: none; font-weight: 700; transition: opacity 0.2s; }
a:hover { opacity: 0.85; }
.alt { display: block; margin-top: 16px; color: #6a6058; font-size: 0.8rem; }
.alt a { background: none; padding: 0; color: #8a8078; display: inline; }
</style>
</head>
<body>
<div class="c">
<div class="lock">&#128274;</div>
<h1>${name}</h1>
<p class="desc">${app.description || 'This is a premium app. Unlock it with CLAWS tokens.'}</p>
<div class="price">${price.toLocaleString()} CLAWS</div>
<p class="creator">by ${creator}</p>
<a href="/apps?id=${app.id}">Unlock This App</a>
<p class="alt">Don't have CLAWS? <a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x7ca47B141639B893C6782823C0b219f872056379&chain=base" target="_blank">Buy on Uniswap</a></p>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).end();
    }

    const slug = (req.query.slug || '').toLowerCase().trim();

    if (!slug || !SLUG_RE.test(slug)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(notFoundPage());
    }

    try {
        const { data, error } = await supabase
            .from('user_apps')
            .select('id, code, claws_price, creator_wallet, creator_x_handle, name, slug, description')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error || !data || !data.code) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(404).send(notFoundPage());
        }

        // Paywall check for paid apps
        if (data.claws_price && parseFloat(data.claws_price) > 0) {
            // Check if user has unlocked
            const user = getUserFromCookie(req);
            let unlocked = false;

            if (user) {
                const { data: unlock } = await supabase
                    .from('app_unlocks')
                    .select('id')
                    .eq('profile_id', user.sub)
                    .eq('app_id', data.id)
                    .maybeSingle();
                unlocked = !!unlock;
            }

            // Allow iframe previews from the app store (Referer check)
            const referer = req.headers.referer || '';
            const isPreview = referer.includes('/apps') || referer.includes('inclawbate.com/apps');

            if (!unlocked && !isPreview) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-store');
                return res.status(402).send(paywallPage(data));
            }
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
