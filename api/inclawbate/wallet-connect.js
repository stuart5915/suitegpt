// Inclawbate — Wallet Connect (no signature required)
// POST { address }
// Finds or creates profile by wallet address, returns JWT + profile

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'ethers';
import { createJwt } from './x-callback.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { address } = req.body || {};

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Valid wallet address required' });
    }

    try {
        const addrLower = address.toLowerCase();

        // Find existing profile by wallet address
        let { data: profile } = await supabase
            .from('human_profiles')
            .select('id, wallet_address, api_key, credits, x_handle, x_name, x_avatar_url, display_name')
            .eq('wallet_address', addrLower)
            .single();

        // If no profile, create one
        if (!profile) {
            const shortAddr = address.slice(0, 6) + '...' + address.slice(-4);
            const handle = 'w_' + addrLower.slice(2, 14);
            const { data: newProfile, error: createErr } = await supabase
                .from('human_profiles')
                .insert({
                    x_id: 'wallet_' + addrLower,
                    x_handle: handle,
                    x_name: shortAddr,
                    wallet_address: addrLower,
                    bio: '',
                    tagline: '',
                    skills: [],
                    available_capacity: 100,
                    availability: 'available'
                })
                .select('id, wallet_address, api_key, credits, x_handle, x_name, display_name')
                .single();

            if (createErr) {
                console.error('Create profile error:', createErr);
                return res.status(500).json({ error: 'Failed to create profile', detail: createErr.message });
            }
            profile = newProfile;
        }

        // Generate API key if needed
        if (!profile.api_key) {
            const newApiKey = 'inclw_' + Buffer.from(randomBytes(24)).toString('hex');
            const { data: updated } = await supabase
                .from('human_profiles')
                .update({ api_key: newApiKey })
                .eq('id', profile.id)
                .select('api_key')
                .single();

            if (updated) {
                profile.api_key = updated.api_key;
            }
        }

        // Issue JWT
        const now = Math.floor(Date.now() / 1000);
        const token = createJwt({
            sub: profile.id,
            x_handle: profile.x_handle,
            wallet_address: addrLower,
            iat: now,
            exp: now + 7 * 24 * 60 * 60
        });

        return res.status(200).json({
            success: true,
            token,
            profile: {
                id: profile.id,
                x_handle: profile.x_handle,
                x_name: profile.x_name,
                x_avatar_url: profile.x_avatar_url || null,
                display_name: profile.display_name || null,
                wallet_address: profile.wallet_address,
                credits: profile.credits || 0,
                api_key: profile.api_key
            }
        });

    } catch (err) {
        console.error('Wallet connect error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
