// Inclawbate — Refresh Avatar from X API
// GET ?handle=xxx — refreshes avatar for a single profile (called from client)
// Uses X API app-only auth (client credentials) to fetch fresh profile_image_url

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

// Cache the app-only bearer token (lasts until server restarts)
let cachedBearerToken = null;

async function getAppBearerToken() {
    if (cachedBearerToken) return cachedBearerToken;

    const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
    const resp = await fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await resp.json();
    if (!resp.ok || !data.access_token) {
        throw new Error('Failed to get X app bearer token');
    }

    cachedBearerToken = data.access_token;
    return cachedBearerToken;
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

    try {
        // Check profile exists and when it was last updated
        const { data: profile, error } = await supabase
            .from('human_profiles')
            .select('id, x_handle, x_avatar_url, updated_at')
            .eq('x_handle', handle)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        // Skip if updated less than 6 hours ago
        const updatedAt = new Date(profile.updated_at).getTime();
        const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
        if (updatedAt > sixHoursAgo) {
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false });
        }

        // Fetch fresh data from X
        const bearerToken = await getAppBearerToken();
        const xResp = await fetch(
            `https://api.twitter.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=profile_image_url,name,description`,
            { headers: { 'Authorization': `Bearer ${bearerToken}` } }
        );

        if (!xResp.ok) {
            // Token might be expired, clear cache and fail gracefully
            if (xResp.status === 401) cachedBearerToken = null;
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false });
        }

        const xData = await xResp.json();
        if (!xData.data) {
            return res.status(200).json({ avatar_url: profile.x_avatar_url, refreshed: false });
        }

        const xUser = xData.data;
        const newAvatarUrl = xUser.profile_image_url
            ? xUser.profile_image_url.replace('_normal', '_400x400')
            : null;

        // Update profile with fresh data
        await supabase
            .from('human_profiles')
            .update({
                x_avatar_url: newAvatarUrl,
                x_name: xUser.name || profile.x_handle,
                updated_at: new Date().toISOString()
            })
            .eq('id', profile.id);

        return res.status(200).json({ avatar_url: newAvatarUrl, refreshed: true });

    } catch (err) {
        console.error('Avatar refresh error:', err);
        return res.status(500).json({ error: 'Failed to refresh avatar' });
    }
}
