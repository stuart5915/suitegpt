// Inclawbate — X OAuth 2.0 Token Exchange
// POST /api/inclawbate/x-callback
// Exchanges auth code for tokens, fetches user data, upserts profile, returns JWT

import { createHmac } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const JWT_SECRET = process.env.INCLAWBATE_JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REDIRECT_URI = 'https://inclawbate.com/launch';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function base64url(str) {
    return Buffer.from(str).toString('base64url');
}

function createJwt(payload) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64url(JSON.stringify(payload));
    const sig = createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${sig}`;
}

export function verifyJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expectedSig = createHmac('sha256', JWT_SECRET)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');
    if (parts[2] !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
}

export function authenticateRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyJwt(authHeader.replace('Bearer ', ''));
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { code, code_verifier, redirect_uri } = req.body;

        if (!code || !code_verifier) {
            return res.status(400).json({ error: 'Missing code or code_verifier' });
        }

        // Exchange code for access token
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirect_uri || REDIRECT_URI,
            code_verifier,
            client_id: X_CLIENT_ID
        });

        const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');

        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`
            },
            body: tokenParams.toString()
        });

        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.access_token) {
            console.error('X token exchange failed:', tokenData);
            return res.status(400).json({ error: 'Failed to exchange code for token', details: tokenData.error_description || tokenData.error });
        }

        // Fetch X user data
        const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,description,name,username', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });

        const userData = await userRes.json();

        if (!userRes.ok || !userData.data) {
            console.error('X user fetch failed:', userData);
            return res.status(400).json({ error: 'Failed to fetch X user data' });
        }

        const xUser = userData.data;

        // Upsert into human_profiles
        const { data: profile, error: dbError } = await supabase
            .from('human_profiles')
            .upsert({
                x_id: xUser.id,
                x_handle: xUser.username.toLowerCase(),
                x_name: xUser.name,
                x_avatar_url: xUser.profile_image_url ? xUser.profile_image_url.replace('_normal', '_400x400') : null,
                x_access_token: tokenData.access_token,
                x_refresh_token: tokenData.refresh_token || null,
                bio: xUser.description || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'x_id' })
            .select()
            .single();

        if (dbError) {
            console.error('Supabase upsert error:', dbError);
            return res.status(500).json({ error: 'Failed to save profile' });
        }

        // Issue JWT
        const now = Math.floor(Date.now() / 1000);
        const jwt = createJwt({
            sub: profile.id,
            x_handle: profile.x_handle,
            x_id: profile.x_id,
            iat: now,
            exp: now + Math.floor(JWT_EXPIRY_MS / 1000)
        });

        return res.status(200).json({
            success: true,
            token: jwt,
            profile: {
                id: profile.id,
                x_handle: profile.x_handle,
                x_name: profile.x_name,
                x_avatar_url: profile.x_avatar_url,
                bio: profile.bio,
                tagline: profile.tagline,
                skills: profile.skills,
                wallet_address: profile.wallet_address,
                min_stake_clawnch: profile.min_stake_clawnch,
                availability: profile.availability,
                contact_preference: profile.contact_preference
            }
        });

    } catch (err) {
        console.error('X callback error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
