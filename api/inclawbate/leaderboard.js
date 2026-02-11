// Public leaderboard API — top humans ranked by total AI replies generated
// No auth required

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { data, error } = await supabase
            .from('human_profiles')
            .select('x_handle, x_name, x_avatar_url, total_replies')
            .gt('total_replies', 0)
            .order('total_replies', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Leaderboard query error:', error);
            return res.status(500).json({ error: 'Failed to fetch leaderboard' });
        }

        const leaderboard = (data || []).map((row, i) => ({
            rank: i + 1,
            x_handle: row.x_handle,
            x_name: row.x_name,
            x_avatar_url: row.x_avatar_url,
            total_replies: row.total_replies
        }));

        return res.status(200).json({ leaderboard });
    } catch (err) {
        console.error('Leaderboard error:', err);
        return res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
}
