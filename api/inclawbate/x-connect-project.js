// Inclawbate — Connect X Account to Project (OAuth 2.0 PKCE)
// POST action:"start"      — returns the X authorize URL for the user to redirect to
// POST action:"callback"   — exchanges code for tokens, stores on project
// POST action:"disconnect"  — removes X tokens from project

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const REDIRECT_URI = 'https://inclawbate.com/agents';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500',
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
    return data;
}

export { refreshAccessToken };

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { action } = req.body;

    // ── Start OAuth flow ──
    if (action === 'start') {
        const { project_id, code_challenge } = req.body;
        if (!project_id || !code_challenge) {
            return res.status(400).json({ error: 'project_id and code_challenge required' });
        }

        // Verify project ownership (check profile ID or wallet)
        const { data: project } = await supabase
            .from('projects')
            .select('creator_profile_id, creator_wallet')
            .eq('id', project_id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });
        const userWallet = (user.wallet_address || '').toLowerCase();
        const isOwner = project.creator_profile_id === user.sub ||
            (userWallet && project.creator_wallet === userWallet);
        if (!isOwner) {
            return res.status(403).json({ error: 'Not the project owner' });
        }

        const state = Buffer.from(JSON.stringify({ project_id, sub: user.sub })).toString('base64url');

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: X_CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: 'tweet.read tweet.write users.read offline.access',
            state,
            code_challenge,
            code_challenge_method: 'S256',
            force_login: 'true'
        });

        return res.status(200).json({
            authorize_url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`
        });
    }

    // ── Exchange code for tokens ──
    if (action === 'callback') {
        const { code, code_verifier, project_id } = req.body;
        if (!code || !code_verifier || !project_id) {
            return res.status(400).json({ error: 'code, code_verifier, and project_id required' });
        }

        // Verify ownership (check profile ID or wallet)
        const { data: project } = await supabase
            .from('projects')
            .select('creator_profile_id, creator_wallet')
            .eq('id', project_id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });
        const cbWallet = (user.wallet_address || '').toLowerCase();
        const cbOwner = project.creator_profile_id === user.sub ||
            (cbWallet && project.creator_wallet === cbWallet);
        if (!cbOwner) {
            return res.status(403).json({ error: 'Not the project owner' });
        }

        // Exchange code for token
        const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
        const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuth}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier,
                client_id: X_CLIENT_ID
            }).toString()
        });

        const tokenData = await tokenRes.json();
        if (!tokenRes.ok || !tokenData.access_token) {
            const hint = tokenData.error_description || tokenData.error || '';
            return res.status(400).json({ error: 'Token exchange failed', detail: hint });
        }

        // Fetch X user info to get handle
        const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url', {
            headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
        });
        const userData = await userRes.json();
        const xHandle = userData.data?.username || null;

        // Store on project
        const { error: updateErr } = await supabase
            .from('projects')
            .update({
                x_access_token: tokenData.access_token,
                x_refresh_token: tokenData.refresh_token || null,
                x_handle: xHandle,
                updated_at: new Date().toISOString()
            })
            .eq('id', project_id);

        if (updateErr) return res.status(500).json({ error: updateErr.message });

        return res.status(200).json({
            success: true,
            x_handle: xHandle,
            x_connected: true
        });
    }

    // ── Disconnect X ──
    if (action === 'disconnect') {
        const { project_id } = req.body;
        if (!project_id) return res.status(400).json({ error: 'project_id required' });

        const { data: project } = await supabase
            .from('projects')
            .select('creator_profile_id, creator_wallet')
            .eq('id', project_id)
            .single();

        if (!project) return res.status(404).json({ error: 'Project not found' });
        const dcWallet = (user.wallet_address || '').toLowerCase();
        const dcOwner = project.creator_profile_id === user.sub ||
            (dcWallet && project.creator_wallet === dcWallet);
        if (!dcOwner) {
            return res.status(403).json({ error: 'Not the project owner' });
        }

        await supabase
            .from('projects')
            .update({
                x_access_token: null,
                x_refresh_token: null,
                x_handle: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', project_id);

        return res.status(200).json({ success: true, x_connected: false });
    }

    return res.status(400).json({ error: 'Unknown action' });
}
