// Inclawbate — Human Profiles API
// GET  /api/inclawbate/humans           — list/search profiles
// GET  /api/inclawbate/humans?handle=x  — get single profile by handle
// POST /api/inclawbate/humans           — update own profile (authed)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUBLIC_FIELDS = 'id,x_handle,x_name,x_avatar_url,bio,tagline,skills,wallet_address,available_capacity,availability,telegram_chat_id,metadata,created_at,updated_at';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — list or fetch single profile
    if (req.method === 'GET') {
        try {
            const { handle, search, skill, availability, sort, offset, limit } = req.query;

            // Single profile by handle
            if (handle) {
                const { data, error } = await supabase
                    .from('human_profiles')
                    .select(PUBLIC_FIELDS)
                    .eq('x_handle', handle.toLowerCase())
                    .single();

                if (error || !data) {
                    return res.status(404).json({ error: 'Profile not found' });
                }
                return res.status(200).json({ profile: data });
            }

            // List profiles
            let query = supabase
                .from('human_profiles')
                .select(PUBLIC_FIELDS, { count: 'exact' });

            // Search by name or handle — sanitize to prevent filter injection
            if (search) {
                const safe = String(search).replace(/[%_,().]/g, '').slice(0, 100);
                if (safe) {
                    query = query.or(`x_handle.ilike.%${safe}%,x_name.ilike.%${safe}%,bio.ilike.%${safe}%,tagline.ilike.%${safe}%`);
                }
            }

            // Filter by skill
            if (skill) {
                query = query.contains('skills', [skill]);
            }

            // Filter by availability
            if (availability) {
                query = query.eq('availability', availability);
            }

            // Sorting
            const sortField = sort === 'oldest' ? 'created_at' : sort === 'alpha' ? 'x_handle' : 'created_at';
            const sortAsc = sort === 'oldest' || sort === 'alpha';
            query = query.order(sortField, { ascending: sortAsc });

            // Pagination
            const lim = Math.min(parseInt(limit) || 48, 100);
            const off = parseInt(offset) || 0;
            query = query.range(off, off + lim - 1);

            const { data, count, error } = await query;

            if (error) {
                return res.status(500).json({ error: 'Failed to fetch profiles' });
            }

            return res.status(200).json({
                profiles: data || [],
                total: count || 0,
                hasMore: (off + lim) < (count || 0)
            });

        } catch (err) {
            // GET error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — update own profile
    if (req.method === 'POST') {
        try {
            const user = authenticateRequest(req);
            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            const {
                tagline, bio, skills,
                wallet_address, available_capacity,
                availability, creative_freedom
            } = req.body;

            const updates = {};
            if (tagline !== undefined) updates.tagline = String(tagline).slice(0, 200);
            if (bio !== undefined) updates.bio = String(bio).slice(0, 2000);
            if (skills !== undefined && Array.isArray(skills)) updates.skills = skills.slice(0, 20).map(s => String(s).slice(0, 50).toLowerCase());
            if (wallet_address !== undefined) {
                if (wallet_address && !/^0x[0-9a-fA-F]{40}$/.test(wallet_address)) {
                    return res.status(400).json({ error: 'Invalid wallet address format' });
                }
                updates.wallet_address = wallet_address || null;
            }
            if (available_capacity !== undefined) updates.available_capacity = Math.max(0, Math.min(100, parseInt(available_capacity) || 100));
            if (availability !== undefined && ['available', 'busy', 'unavailable'].includes(availability)) updates.availability = availability;
            if (creative_freedom !== undefined && ['full', 'guided', 'strict'].includes(creative_freedom)) updates.creative_freedom = creative_freedom;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }

            const { data, error } = await supabase
                .from('human_profiles')
                .update(updates)
                .eq('id', user.sub)
                .select(PUBLIC_FIELDS)
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to update profile' });
            }

            return res.status(200).json({ success: true, profile: data });

        } catch (err) {
            // POST error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
