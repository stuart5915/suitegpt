// Post to X (Twitter) API
// Requires environment variables:
// - X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET

import crypto from 'crypto';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;

    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
        return res.status(500).json({ error: 'X API credentials not configured' });
    }

    try {
        const { text, postId } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }

        if (text.length > 280) {
            return res.status(400).json({ error: 'Tweet exceeds 280 characters' });
        }

        // OAuth 1.0a signature
        const oauth = {
            oauth_consumer_key: X_API_KEY,
            oauth_nonce: crypto.randomBytes(16).toString('hex'),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_token: X_ACCESS_TOKEN,
            oauth_version: '1.0'
        };

        const url = 'https://api.twitter.com/2/tweets';
        const method = 'POST';

        // Create signature base string
        const paramString = Object.keys(oauth)
            .sort()
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauth[k])}`)
            .join('&');

        const signatureBase = [
            method,
            encodeURIComponent(url),
            encodeURIComponent(paramString)
        ].join('&');

        // Create signing key
        const signingKey = `${encodeURIComponent(X_API_SECRET)}&${encodeURIComponent(X_ACCESS_SECRET)}`;

        // Generate signature
        const signature = crypto
            .createHmac('sha1', signingKey)
            .update(signatureBase)
            .digest('base64');

        oauth.oauth_signature = signature;

        // Build Authorization header
        const authHeader = 'OAuth ' + Object.keys(oauth)
            .sort()
            .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauth[k])}"`)
            .join(', ');

        // Post tweet
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('X API error:', data);
            return res.status(response.status).json({
                error: data.detail || data.title || 'Failed to post to X',
                details: data
            });
        }

        return res.status(200).json({
            success: true,
            tweetId: data.data?.id,
            postId: postId
        });

    } catch (error) {
        console.error('X posting error:', error);
        return res.status(500).json({ error: 'Failed to post to X' });
    }
}
