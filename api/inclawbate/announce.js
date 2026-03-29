// Inclawbate — Post announcement tweet as @inclawbator
// POST { text } → { tweetId, url }
// Uses OAuth 1.0a (same credentials as x-responder)

import crypto from 'crypto';

const X_API_KEY = process.env.INCLAWBATOR_X_API_KEY;
const X_API_SECRET = process.env.INCLAWBATOR_X_API_SECRET;
const X_ACCESS_TOKEN = process.env.INCLAWBATOR_X_ACCESS_TOKEN;
const X_ACCESS_SECRET = process.env.INCLAWBATOR_X_ACCESS_SECRET;

function oauthHeader(method, url) {
    const oauth = {
        oauth_consumer_key: X_API_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: X_ACCESS_TOKEN,
        oauth_version: '1.0'
    };

    const paramString = Object.keys(oauth).sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
        .join('&');

    const signatureBase = [method, encodeURIComponent(url), encodeURIComponent(paramString)].join('&');
    const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;
    oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    return 'OAuth ' + Object.keys(oauth).sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
        .join(', ');
}

const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    // Admin-only: require CRON_SECRET or admin wallet in body
    const cronSecret = req.headers['x-cron-secret'] || req.headers['authorization']?.replace('Bearer ', '');
    const wallet = (req.body?.wallet || '').toLowerCase();
    const isAdmin = (cronSecret && cronSecret === process.env.CRON_SECRET)
        || wallet === SUPER_ADMIN;

    if (!isAdmin) {
        return res.status(403).json({ error: 'Admin only' });
    }

    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text is required' });
    if (!X_API_KEY || !X_ACCESS_TOKEN) return res.status(500).json({ error: 'X credentials not configured' });

    try {
        const url = 'https://api.twitter.com/2/tweets';
        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': oauthHeader('POST', url),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        const data = await resp.json();
        if (!resp.ok) {
            console.error('Announce tweet failed:', data);
            return res.status(resp.status).json({ error: data.detail || data.title || 'Tweet failed' });
        }

        const tweetId = data.data?.id;
        return res.status(200).json({
            tweetId,
            url: tweetId ? `https://x.com/inclawbator/status/${tweetId}` : null
        });
    } catch (e) {
        console.error('Announce error:', e);
        return res.status(500).json({ error: e.message });
    }
}
