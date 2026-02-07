// Quest Board — List Quests
// GET /api/swarm/quest-list

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://getsuite.app', 'https://www.getsuite.app',
    'https://suitegpt.app', 'https://www.suitegpt.app',
    'http://localhost:3000', 'http://localhost:5500'
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
        const { status, role, category, difficulty, limit } = req.query;
        const maxLimit = Math.min(parseInt(limit) || 50, 100);

        let query = supabase
            .from('quest_board')
            .select('id, title, description, reward_credits, status, category, difficulty, role_match, auto_assigned, priority, created_by_type, claimed_at, completed_at, created_at')
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(maxLimit);

        if (status) query = query.eq('status', status);
        if (role) query = query.eq('role_match', role);
        if (category) query = query.eq('category', category);
        if (difficulty) query = query.eq('difficulty', difficulty);

        const { data: quests, error } = await query;

        if (error) {
            console.error('Quest list error:', error);
            return res.status(500).json({ error: 'Failed to fetch quests' });
        }

        return res.status(200).json({
            success: true,
            quests: quests || [],
            count: quests?.length || 0
        });
    } catch (error) {
        console.error('Quest list error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
