// Inclawbate — Refresh Avatar from X API
// GET ?handle=xxx — refreshes avatar for a single profile (called from client)
// Uses the user's stored X refresh token to get fresh profile data

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

async function refreshAccessToken(refreshToken) {
    const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`
        },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: X_CLIENT_ID
        }).toString()
    });

    const data = await resp.json();
    if (!resp.ok || !data.access_token) return null;
    return data; // { access_token, refresh_token, ... }
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const handle = (req.query.handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!handle) return res.status(400).json({ error: 'handle required' });

    const force = req.query.force === '1';

    try {
        const { data: profile, error } = await supabase
            .from('human_profiles')
            .select('id, x_handle, x_avatar_url, x_refresh_token, updated_at')
            .eq('x_handle', handle)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Skip if updated less than 6 hours ago (unless forced)
        const updatedAt = new Date(profile.updated_at).getTime();
        const ageMs = Date.now() - updatedAt;
        if (!force && ageMs < 6 * 60 * 60 * 1000) {
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false, reason: 'fresh', age_hours: Math.round(ageMs / 3600000 * 10) / 10 });
        }

        // Need a refresh token to proceed
        if (!profile.x_refresh_token) {
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false, reason: 'no_refresh_token' });
        }

        // Get fresh access token using refresh token
        const tokenData = await refreshAccessToken(profile.x_refresh_token);
        if (!tokenData) {
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false, reason: 'token_refresh_failed' });
        }

        // Fetch fresh user data from X
        const xResp = await fetch(
            'https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,description',
            { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } }
        );

        if (!xResp.ok) {
            const xErr = await xResp.text().catch(() => '');
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false, reason: 'x_api_error', status: xResp.status, detail: xErr.slice(0, 200) });
        }

        const xData = await xResp.json();
        if (!xData.data) {
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false });
        }

        const xUser = xData.data;
        const newAvatarUrl = xUser.profile_image_url
            ? xUser.profile_image_url.replace('_normal', '_400x400')
            : null;

        // Update profile with fresh data + new tokens
        await supabase
            .from('human_profiles')
            .update({
                x_avatar_url: newAvatarUrl,
                x_name: xUser.name || profile.x_handle,
                x_access_token: tokenData.access_token,
                x_refresh_token: tokenData.refresh_token || profile.x_refresh_token,
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.id);

        return res.status(200).json({ avatar_url: newAvatarUrl, refreshed: true });

    } catch (err) {
        console.error('Avatar refresh error:', err);
        return res.status(500).json({ error: 'Failed to refresh avatar' });
    }
}
