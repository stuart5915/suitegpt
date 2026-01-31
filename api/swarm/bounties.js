// Swarm Portal — List Bounties
// GET /api/swarm/bounties
// Public endpoint, returns open bounties with optional ?category= filter

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://getsuite.app',
    'https://www.getsuite.app',
    'https://suitegpt.app',
    'https://www.suitegpt.app',
    'http://localhost:3000',
    'http://localhost:5500'
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { category, status } = req.query;

        let query = supabase
            .from('swarm_bounties')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter by status (default: open)
        if (status) {
            query = query.eq('status', status);
        } else {
            query = query.in('status', ['open', 'claimed', 'in_progress']);
        }

        // Filter by category if provided
        if (category) {
            query = query.eq('category', category);
        }

        const { data: bounties, error } = await query;

        if (error) {
            console.error('Bounties fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch bounties' });
        }

        return res.status(200).json({
            success: true,
            bounties,
            count: bounties.length
        });

    } catch (error) {
        console.error('Bounties error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
