// Inclawbate — Inclawbators Directory
// GET → return all public profiles with skills and availability
// POST → update your own profile (requires auth)

import { createClient } from '@supabase/supabase-js';
import { verifyMessage } from 'ethers';

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — public directory
    if (req.method === 'GET') {
        try {
            const { data: profiles } = await supabase
                .from('human_profiles')
                .select('wallet_address, x_handle, x_name, x_avatar_url, bio, tagline, skills, available_capacity, availability')
                .not('skills', 'eq', '{}')
                .order('available_capacity', { ascending: false });

            // Filter to profiles that have at least some content
            const visible = (profiles || []).filter(p =>
                (p.skills && p.skills.length > 0) || (p.bio && p.bio.length > 0) || (p.tagline && p.tagline.length > 0)
            );

            return res.status(200).json({ success: true, inclawbators: visible });
        } catch (err) {
            console.error('Inclawbators fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch directory' });
        }
    }

    // POST — update your profile
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { address, signature, message, bio, tagline, skills, availability } = req.body || {};

    if (!address || !signature || !message) {
        return res.status(400).json({ error: 'address, signature, and message required' });
    }

    // Verify timestamp
    const tsMatch = message.match(/Timestamp: (\d+)/);
    if (!tsMatch) return res.status(400).json({ error: 'Invalid message format' });
    const ts = parseInt(tsMatch[1]);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) return res.status(400).json({ error: 'Message expired' });

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
        const updates = {};
        if (bio !== undefined) updates.bio = String(bio).slice(0, 500);
        if (tagline !== undefined) updates.tagline = String(tagline).slice(0, 120);
        if (skills !== undefined && Array.isArray(skills)) updates.skills = skills.slice(0, 20);
        if (availability !== undefined) updates.availability = ['available', 'busy', 'unavailable'].includes(availability) ? availability : 'available';

        const { data: profile, error: updateErr } = await supabase
            .from('human_profiles')
            .update(updates)
            .eq('wallet_address', address.toLowerCase())
            .select('wallet_address, x_handle, x_name, x_avatar_url, bio, tagline, skills, available_capacity, availability')
            .single();

        if (updateErr) {
            console.error('Profile update error:', updateErr);
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        return res.status(200).json({ success: true, profile });
    } catch (err) {
        console.error('Profile update error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
