// Test endpoint — verify @inclawbator X posting works
// POST with { text } or GET to send a default test tweet
// DELETE THIS FILE after confirming it works

import crypto from 'crypto';

function signAndPost(apiKey, apiSecret, accessToken, accessSecret, text) {
    const oauth = {
        oauth_consumer_key: apiKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: accessToken,
        oauth_version: '1.0'
    };

    const url = 'https://api.twitter.com/2/tweets';
    const paramString = Object.keys(oauth)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
        .join('&');

    const signatureBase = ['POST', encodeURIComponent(url), encodeURIComponent(paramString)].join('&');
    const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
    oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

    const authHeader = 'OAuth ' + Object.keys(oauth)
        .sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
        .join(', ');

    return fetch(url, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { INCLAWBATOR_X_API_KEY, INCLAWBATOR_X_API_SECRET, INCLAWBATOR_X_ACCESS_TOKEN, INCLAWBATOR_X_ACCESS_SECRET } = process.env;

    if (!INCLAWBATOR_X_API_KEY || !INCLAWBATOR_X_API_SECRET || !INCLAWBATOR_X_ACCESS_TOKEN || !INCLAWBATOR_X_ACCESS_SECRET) {
        return res.status(500).json({ error: 'INCLAWBATOR_X keys not configured', keys: {
            api_key: !!INCLAWBATOR_X_API_KEY,
            api_secret: !!INCLAWBATOR_X_API_SECRET,
            access_token: !!INCLAWBATOR_X_ACCESS_TOKEN,
            access_secret: !!INCLAWBATOR_X_ACCESS_SECRET,
        }});
    }

    const text = req.body?.text || `gm from the inclawbator — test post ${Date.now()}`;

    try {
        const response = await signAndPost(
            INCLAWBATOR_X_API_KEY, INCLAWBATOR_X_API_SECRET,
            INCLAWBATOR_X_ACCESS_TOKEN, INCLAWBATOR_X_ACCESS_SECRET,
            text
        );
        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: 'X API error', status: response.status, details: data });
        }

        return res.status(200).json({ success: true, tweet_id: data.data?.id, text });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
