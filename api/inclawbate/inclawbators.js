// Inclawbate — Inclawbators Directory
// GET → return all public profiles with portfolio stats
// POST → update your own profile (wallet signature auth)

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

const PUBLIC_FIELDS = 'wallet_address,x_handle,x_name,x_avatar_url,display_name,bio,tagline,skills,available_capacity,availability,response_time,timezone,portfolio_links,hire_count,telegram_chat_id,contact_method,created_at';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — public directory with portfolio stats
    if (req.method === 'GET') {
        try {
            const { data: profiles } = await supabase
                .from('human_profiles')
                .select(PUBLIC_FIELDS)
                .order('available_capacity', { ascending: false });

            // Filter to profiles that have at least some content
            const visible = (profiles || []).filter(p =>
                (p.skills && p.skills.length > 0) || (p.bio && p.bio.length > 0) || (p.tagline && p.tagline.length > 0)
            );

            if (visible.length === 0) {
                return res.status(200).json({ success: true, inclawbators: [] });
            }

            // Collect wallets for batch stats queries
            const wallets = visible.map(p => p.wallet_address).filter(Boolean);

            // Batch: tokens launched per wallet
            const { data: tokenCounts } = await supabase
                .from('inclawbator_projects')
                .select('creator_wallet, token_address')
                .in('creator_wallet', wallets)
                .not('token_address', 'is', null);

            const tokenMap = {};
            (tokenCounts || []).forEach(t => {
                const w = t.creator_wallet?.toLowerCase();
                if (w) tokenMap[w] = (tokenMap[w] || 0) + 1;
            });

            // Batch: apps built per wallet
            const { data: appCounts } = await supabase
                .from('user_apps')
                .select('creator_wallet')
                .in('creator_wallet', wallets)
                .eq('is_public', true);

            const appMap = {};
            (appCounts || []).forEach(a => {
                const w = a.creator_wallet?.toLowerCase();
                if (w) appMap[w] = (appMap[w] || 0) + 1;
            });

            // Batch: CLAWS earned from hire conversations
            const { data: earnings } = await supabase
                .from('inclawbate_conversations')
                .select('human_id, payment_amount')
                .not('payment_amount', 'is', null);

            // Map human_id → total earned (need to cross-reference with profiles)
            const earnMap = {};
            (earnings || []).forEach(e => {
                if (e.human_id && e.payment_amount) {
                    earnMap[e.human_id] = (earnMap[e.human_id] || 0) + parseFloat(e.payment_amount);
                }
            });

            // Enrich profiles with stats
            const enriched = visible.map(p => {
                const w = p.wallet_address?.toLowerCase();
                return {
                    ...p,
                    tokens_launched: tokenMap[w] || 0,
                    apps_built: appMap[w] || 0,
                    claws_earned: 0 // TODO: cross-ref human_id once available
                };
            });

            return res.status(200).json({ success: true, inclawbators: enriched });
        } catch (err) {
            console.error('Inclawbators fetch error:', err);
            return res.status(500).json({ error: 'Failed to fetch directory' });
        }
    }

    // POST — update your profile (wallet signature)
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { address, signature, message, bio, tagline, skills, availability,
            display_name, portfolio_links, response_time, timezone } = req.body || {};

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
        if (display_name !== undefined) updates.display_name = String(display_name).slice(0, 50);
        if (response_time !== undefined) updates.response_time = ['under_1h', 'under_4h', 'under_24h', 'under_48h'].includes(response_time) ? response_time : null;
        if (timezone !== undefined) updates.timezone = String(timezone).slice(0, 50);
        if (portfolio_links !== undefined && Array.isArray(portfolio_links)) {
            updates.portfolio_links = portfolio_links
                .filter(l => typeof l === 'string' && l.startsWith('http'))
                .slice(0, 5);
        }

        const { data: profile, error: updateErr } = await supabase
            .from('human_profiles')
            .update(updates)
            .eq('wallet_address', address.toLowerCase())
            .select(PUBLIC_FIELDS)
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
