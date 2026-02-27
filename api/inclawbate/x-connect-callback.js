// X OAuth 1.0a — Callback (leg 3 of 3-legged OAuth)
// GET /api/inclawbate/x-connect-callback?oauth_token=xxx&oauth_verifier=xxx
// Exchanges for access token, stores in project, redirects to inclawbator page

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

    const { oauth_token, oauth_verifier } = req.query;

    // User denied
    if (!oauth_verifier) {
        return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=denied');
    }

    if (!oauth_token) {
        return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=error');
    }

    const X_API_KEY = process.env.INCLAWBATE_X_API_KEY;
    const X_API_SECRET = process.env.INCLAWBATE_X_API_SECRET;
    if (!X_API_KEY || !X_API_SECRET) {
        return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=error');
    }

    try {
        // Look up the temp record
        const { data: temp } = await supabase
            .from('inclawbator_x_oauth_temp')
            .select('*')
            .eq('oauth_token', oauth_token)
            .single();

        if (!temp) {
            return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=expired');
        }

        // Exchange for access token
        const accessTokenUrl = 'https://api.twitter.com/oauth/access_token';

        const oauthParams = {
            oauth_consumer_key: X_API_KEY,
            oauth_nonce: crypto.randomBytes(16).toString('hex'),
            oauth_signature_method: 'HMAC-SHA1',
            oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
            oauth_token: oauth_token,
            oauth_verifier: oauth_verifier,
            oauth_version: '1.0'
        };

        oauthParams.oauth_signature = oauthSign(
            'POST', accessTokenUrl, oauthParams,
            X_API_SECRET, temp.oauth_token_secret
        );

        const resp = await fetch(accessTokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': buildAuthHeader(oauthParams)
            }
        });

        const body = await resp.text();
        if (!resp.ok) {
            console.error('X access_token error:', body);
            return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=error');
        }

        const params = new URLSearchParams(body);
        const accessToken = params.get('oauth_token');
        const accessSecret = params.get('oauth_token_secret');
        const screenName = params.get('screen_name');

        if (!accessToken || !accessSecret) {
            return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=error');
        }

        // Store tokens on the project
        const updateData = {
            x_access_token: accessToken,
            x_access_secret: accessSecret,
            updated_at: new Date().toISOString()
        };

        // Also update x_handle if we got the screen name
        if (screenName) {
            updateData.x_handle = screenName;
        }

        await supabase
            .from('inclawbator_projects')
            .update(updateData)
            .eq('id', temp.project_id);

        // Clean up temp
        await supabase
            .from('inclawbator_x_oauth_temp')
            .delete()
            .eq('oauth_token', oauth_token);

        // Redirect back with success
        return res.redirect(302, `https://inclawbate.com/inclawbator?x_connect=success&handle=${screenName || ''}`);

    } catch (e) {
        console.error('x-connect-callback error:', e);
        return res.redirect(302, 'https://inclawbate.com/inclawbator?x_connect=error');
    }
}
