// Inclawbate — Wallet Login
// POST { address, signature, message }
// Verifies wallet ownership via signed message, finds/creates profile, returns API key

import { createClient } from '@supabase/supabase-js';
import { verifyMessage, randomBytes } from 'ethers';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
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

    const { address, signature, message } = req.body || {};

    if (!address || !signature || !message) {
        return res.status(400).json({ error: 'address, signature, and message required' });
    }

    // Verify the message was signed recently (within 5 minutes)
    const tsMatch = message.match(/Timestamp: (\d+)/);
    if (!tsMatch) {
        return res.status(400).json({ error: 'Invalid message format' });
    }
    const ts = parseInt(tsMatch[1]);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) {
        return res.status(400).json({ error: 'Message expired, please try again' });
    }

    // Verify signature
    let recoveredAddress;
    try {
        recoveredAddress = verifyMessage(message, signature);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid signature' });
    }

    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        return res.status(400).json({ error: 'Signature does not match address' });
    }

    try {
        // Find existing profile by wallet address
        let { data: profile } = await supabase
            .from('human_profiles')
            .select('id, wallet_address, api_key, credits, x_handle, x_name, x_avatar_url')
            .eq('wallet_address', address.toLowerCase())
            .single();

        // If no profile, create one with just the wallet address
        if (!profile) {
            const addrLower = address.toLowerCase();
            const shortAddr = address.slice(0, 6) + '...' + address.slice(-4);
            // Use wallet address as x_id and generate a unique handle from it
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
                .select('id, wallet_address, api_key, credits, x_handle, x_name')
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

        return res.status(200).json({
            success: true,
            api_key: profile.api_key,
            wallet_address: profile.wallet_address,
            credits: profile.credits || 0,
            x_handle: profile.x_handle,
            x_name: profile.x_name
        });

    } catch (err) {
        console.error('Wallet login error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
