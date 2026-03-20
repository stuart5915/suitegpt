// X OAuth 1.0a — Initiate (leg 1 of 3-legged OAuth)
// GET /api/inclawbate/x-connect?project_id=xxx
// Redirects user to X authorization page

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function oauthSign(method, url, params, consumerSecret, tokenSecret) {
    const paramString = Object.keys(params)
        .sort()
        .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
        .join('&');

    const signatureBase = [
        method,
        encodeURIComponent(url),
        encodeURIComponent(paramString)
    ].join('&');

    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;
    return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

function buildAuthHeader(params) {
    return 'OAuth ' + Object.keys(params)
        .filter(k => k.startsWith('oauth_'))
        .sort()
        .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(params[k])}"`)
        .join(', ');
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

    const { project_id, wallet } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const X_API_KEY = process.env.INCLAWBATE_X_API_KEY;
    const X_API_SECRET = process.env.INCLAWBATE_X_API_SECRET;
    if (!X_API_KEY || !X_API_SECRET) {
        return res.status(500).json({ error: 'X API credentials not configured' });
    }

    // Verify project exists and caller is owner
    const { data: project } = await supabase
        .from('inclawbator_projects')
        .select('id, creator_wallet')
        .eq('id', project_id)
        .single();

    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (!wallet || project.creator_wallet !== wallet.toLowerCase()) {
        return res.status(403).json({ error: 'Only the project owner can connect X' });
    }

    try {
        // Determine callback URL
        const host = req.headers['x-forwarded-host'] || req.headers.host || 'inclawbate.app';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const callbackUrl = `${protocol}://${host}/api/inclawbate/x-connect-callback`;

        const requestTokenUrl = 'https://api.twitter.com/oauth/request_token';

        const oauthParams = {
            oauth_callback: callbackUrl,
            oauth_consumer_key: X_API_KEY,
            oauth_nonce: crypto.randomBytes(16).toString('hex'),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_version: '1.0'
        };

        oauthParams.oauth_signature = oauthSign('POST', requestTokenUrl, oauthParams, X_API_SECRET, '');

        const resp = await fetch(requestTokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': buildAuthHeader(oauthParams)
            }
        });

        const body = await resp.text();
        if (!resp.ok) {
            console.error('X request_token error:', resp.status, body);
            return res.status(502).json({ error: 'Failed to get request token from X', status: resp.status, detail: body });
        }

        const params = new URLSearchParams(body);
        const oauthToken = params.get('oauth_token');
        const oauthTokenSecret = params.get('oauth_token_secret');

        if (!oauthToken || !oauthTokenSecret) {
            return res.status(502).json({ error: 'Invalid response from X' });
        }

        // Store temp token + project association
        // Clean up old temp rows first (>10 min)
        await supabase
            .from('inclawbator_x_oauth_temp')
            .delete()
            .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

        await supabase
            .from('inclawbator_x_oauth_temp')
            .upsert({
                oauth_token: oauthToken,
                oauth_token_secret: oauthTokenSecret,
                project_id: project_id
            });

        // Redirect user to X authorization
        res.redirect(302, `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`);

    } catch (e) {
        console.error('x-connect error:', e);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
