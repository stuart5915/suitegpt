// Inclawbate — Agent Replies API
// GET ?project_id=X — list replies for a project (auth required)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'http://localhost:3000',
    'http://localhost:5500',
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { project_id } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    // Verify ownership
    const { data: project } = await supabase
        .from('projects')
        .select('creator_wallet, creator_profile_id')
        .eq('id', project_id)
        .single();

    if (!project) return res.status(404).json({ error: 'Project not found' });
    const userWallet = (user.wallet_address || '').toLowerCase();
    const isOwner = project.creator_profile_id === user.sub ||
        (userWallet && project.creator_wallet === userWallet);
    if (!isOwner) return res.status(403).json({ error: 'Not your project' });

    // Count today's posted replies
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
        .from('agent_replies')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project_id)
        .eq('status', 'posted')
        .gte('created_at', startOfDay.toISOString());

    // Fetch recent replies
    const { data: replies, error } = await supabase
        .from('agent_replies')
        .select('*')
        .eq('project_id', project_id)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
        replies: replies || [],
        today_count: todayCount || 0
    });
}
