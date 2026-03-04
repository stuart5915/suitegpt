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
    const creatorWallet = app.creator_wallet || '';
    const priceWei = BigInt(Math.ceil(price)) * BigInt('1000000000000000000');
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
.btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #c05a3c, #d4845a); color: #fff; border-radius: 12px; border: none; font-family: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; transition: all 0.2s; }
.btn:hover { opacity: 0.85; transform: translateY(-1px); }
.btn:disabled { opacity: 0.4; cursor: default; transform: none; }
.status { margin-top: 16px; font-size: 0.85rem; min-height: 1.2em; }
.status.error { color: #ef4444; }
.status.success { color: #4ade80; }
.alt { display: block; margin-top: 16px; color: #6a6058; font-size: 0.8rem; }
.alt a { color: #8a8078; text-decoration: none; }
.alt a:hover { color: #c9a86c; }
.login-link { color: #8a8078; text-decoration: underline; cursor: pointer; }
</style>
</head>
<body>
<div class="c">
<div class="lock">&#128274;</div>
<h1>${name}</h1>
<p class="desc">${app.description || 'This is a premium app. Pay once to unlock it forever.'}</p>
<div class="price">${price.toLocaleString()} CLAWS — one-time unlock</div>
<p class="creator">by ${creator}</p>
<button class="btn" id="unlockBtn" onclick="unlockApp()">Pay ${price.toLocaleString()} CLAWS</button>
<div class="status" id="status"></div>
<p class="alt">Don't have CLAWS? <a href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x7ca47B141639B893C6782823C0b219f872056379&chain=base" target="_blank">Buy on Uniswap</a></p>
</div>
<script>
var CLAWS = '0x7ca47B141639B893C6782823C0b219f872056379';
var CREATOR = '${creatorWallet}';
var APP_ID = '${app.id}';
var AMOUNT_WEI = '${priceWei.toString(16)}';

function getToken() {
    return localStorage.getItem('inclawbate_token');
}

async function unlockApp() {
    var btn = document.getElementById('unlockBtn');
    var status = document.getElementById('status');

    if (!getToken()) {
        status.innerHTML = 'You need to log in first. <a class="login-link" href="/launch">Log in</a>';
        status.className = 'status error';
        return;
    }

    if (!window.ethereum) {
        status.textContent = 'No wallet detected. Install MetaMask or another browser wallet.';
        status.className = 'status error';
        return;
    }

    btn.disabled = true;
    status.textContent = '';
    status.className = 'status';

    try {
        var chainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (chainId !== '0x2105') {
            try {
                await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
            } catch (e) {
                status.textContent = 'Please switch to Base network.';
                status.className = 'status error';
                btn.disabled = false;
                return;
            }
        }

        var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        var from = accounts[0];

        var selector = '0xa9059cbb';
        var paddedAddr = CREATOR.slice(2).toLowerCase().padStart(64, '0');
        var paddedAmt = AMOUNT_WEI.padStart(64, '0');
        var data = selector + paddedAddr + paddedAmt;

        status.textContent = 'Confirm in your wallet...';

        var txHash = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{ from: from, to: CLAWS, data: data }]
        });

        status.textContent = 'Transaction sent! Verifying...';

        var resp = await fetch('/api/inclawbate/apps', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getToken()
            },
            body: JSON.stringify({ action: 'unlock', app_id: APP_ID, tx_hash: txHash })
        });
        var result = await resp.json();

        if (resp.ok && result.unlocked) {
            status.textContent = 'Unlocked! Reloading...';
            status.className = 'status success';
            document.cookie = 'inclawbate_token=' + encodeURIComponent(getToken()) + '; path=/; max-age=2592000; SameSite=Lax';
            setTimeout(function() { location.reload(); }, 1000);
        } else {
            status.textContent = result.error || 'Verification failed. Try again in a moment.';
            status.className = 'status error';
            btn.disabled = false;
        }
    } catch (e) {
        if (e.code === 4001) {
            status.textContent = 'Transaction cancelled.';
        } else {
            status.textContent = e.message || 'Transaction failed.';
        }
        status.className = 'status error';
        btn.disabled = false;
    }
}
</script>
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
            .select('id, code, app_url, claws_price, creator_wallet, creator_x_handle, name, slug, description')
            .eq('slug', slug)
            .eq('is_public', true)
            .single();

        if (error || !data) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(404).send(notFoundPage());
        }

        // If app has no code but has an external URL, redirect
        if (!data.code && data.app_url) {
            return res.redirect(302, data.app_url);
        }

        if (!data.code) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(404).send(notFoundPage());
        }

        // Paywall check for paid apps
        if (data.claws_price && parseFloat(data.claws_price) > 0) {
            // Check if user has unlocked
            const user = getUserFromCookie(req);
            let unlocked = false;

            if (user) {
                // Creator always has access to their own app
                if (data.creator_wallet && user.wallet_address && user.wallet_address.toLowerCase() === data.creator_wallet.toLowerCase()) {
                    unlocked = true;
                }

                if (!unlocked) {
                    const { data: unlock } = await supabase
                        .from('app_unlocks')
                        .select('id')
                        .eq('profile_id', user.sub)
                        .eq('app_id', data.id)
                        .maybeSingle();
                    unlocked = !!unlock;
                }
            }

            if (!unlocked) {
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-store');
                return res.status(402).send(paywallPage(data));
            }
        }

        // Inject CLAWS SDK + AppDB SDK before </body>
        let html = data.code;
        const sdkAttrs = `data-creator-wallet="${data.creator_wallet || ''}" data-app-id="${data.id}"`;
        const sdkTag = `<script src="https://inclawbate.com/js/claws-sdk.js" ${sdkAttrs}></script>`;
        const appdbTag = `<script src="https://inclawbate.com/js/appdb-sdk.js" data-app-id="${data.id}"></script>`;
        if (html.includes('</body>')) {
            html = html.replace('</body>', sdkTag + '\n' + appdbTag + '\n</body>');
        } else {
            html += '\n' + sdkTag + '\n' + appdbTag;
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        // Don't set X-Frame-Options so sites can be embedded
        return res.status(200).send(html);

    } catch (err) {
        console.error('serve-site error:', err);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(500).send(notFoundPage());
    }
}
