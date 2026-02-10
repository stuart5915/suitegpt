// Inclawbate — Human Profiles API
// GET  /api/inclawbate/humans           — list/search profiles
// GET  /api/inclawbate/humans?handle=x  — get single profile by handle
// POST /api/inclawbate/humans           — update own profile (authed)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'http://localhost:3000',
    'http://localhost:5500'
];

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PUBLIC_FIELDS = 'id,x_handle,x_name,x_avatar_url,bio,tagline,services,skills,wallet_address,creative_freedom,availability,contact_preference,metadata,created_at,updated_at';

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

            // Search by name or handle
            if (search) {
                query = query.or(`x_handle.ilike.%${search}%,x_name.ilike.%${search}%,bio.ilike.%${search}%,tagline.ilike.%${search}%`);
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
                console.error('Humans list error:', error);
                return res.status(500).json({ error: 'Failed to fetch profiles' });
            }

            return res.status(200).json({
                profiles: data || [],
                total: count || 0,
                hasMore: (off + lim) < (count || 0)
            });

        } catch (err) {
            console.error('Humans GET error:', err);
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
                tagline, bio, services, skills,
                wallet_address, creative_freedom,
                availability, contact_preference, metadata
            } = req.body;

            const updates = {};
            if (tagline !== undefined) updates.tagline = tagline;
            if (bio !== undefined) updates.bio = bio;
            if (services !== undefined) updates.services = services;
            if (skills !== undefined) updates.skills = skills;
            if (wallet_address !== undefined) updates.wallet_address = wallet_address;
            if (creative_freedom !== undefined) updates.creative_freedom = creative_freedom;
            if (availability !== undefined) updates.availability = availability;
            if (contact_preference !== undefined) updates.contact_preference = contact_preference;
            if (metadata !== undefined) updates.metadata = metadata;

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
                console.error('Profile update error:', error);
                return res.status(500).json({ error: 'Failed to update profile' });
            }

            return res.status(200).json({ success: true, profile: data });

        } catch (err) {
            console.error('Humans POST error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
