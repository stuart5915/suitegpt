// Inclawbate — Agent Posts API
// GET ?project_id=...  — posts for a specific project
// GET ?wallet=...      — all posts for a user's projects

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'http://localhost:3000',
    'http://localhost:5500',
];

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { project_id, wallet } = req.query;

    // Public mode — latest post per active agent (for Explore directory)
    if (req.query.public === '1') {
        const { data: agents } = await supabase
            .from('projects')
            .select('id, name, slug, logo_url, x_handle, agent_persona, agent_total_posts, agent_status, agent_posts_per_day, token_symbol, description')
            .eq('agent_enabled', true)
            .eq('agent_status', 'active');

        if (!agents || !agents.length) {
            return res.status(200).json({ agents: [] });
        }

        const agentIds = agents.map(a => a.id);

        // Get latest post per agent
        const { data: posts } = await supabase
            .from('project_agent_posts')
            .select('project_id, tweet_text, tweet_id, created_at, posted_via')
            .in('project_id', agentIds)
            .eq('status', 'posted')
            .order('created_at', { ascending: false })
            .limit(200);

        const latestPost = {};
        (posts || []).forEach(p => {
            if (!latestPost[p.project_id]) latestPost[p.project_id] = p;
        });

        const enriched = agents.map(a => ({
            ...a,
            latest_tweet: latestPost[a.id]?.tweet_text || null,
            latest_tweet_id: latestPost[a.id]?.tweet_id || null,
            latest_tweet_at: latestPost[a.id]?.created_at || null,
            posted_via: latestPost[a.id]?.posted_via || null
        }));

        return res.status(200).json({ agents: enriched });
    }

    // By project ID
    if (project_id) {
        const { data, error } = await supabase
            .from('project_agent_posts')
            .select('*')
            .eq('project_id', project_id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ posts: data || [] });
    }

    // By wallet — get all projects for this wallet, then their posts
    if (wallet) {
        const walletLower = wallet.toLowerCase().trim();

        const { data: projects } = await supabase
            .from('projects')
            .select('id, name, x_handle')
            .eq('creator_wallet', walletLower)
            .eq('agent_enabled', true);

        if (!projects || !projects.length) {
            return res.status(200).json({ posts: [] });
        }

        const projectIds = projects.map(p => p.id);
        const projectMap = {};
        projects.forEach(p => { projectMap[p.id] = p; });

        const { data: posts, error } = await supabase
            .from('project_agent_posts')
            .select('*')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) return res.status(500).json({ error: error.message });

        // Enrich with project name
        const enriched = (posts || []).map(post => ({
            ...post,
            project_name: projectMap[post.project_id]?.name || 'Unknown',
            x_handle: projectMap[post.project_id]?.x_handle || null
        }));

        return res.status(200).json({ posts: enriched });
    }

    return res.status(400).json({ error: 'project_id or wallet required' });
}
