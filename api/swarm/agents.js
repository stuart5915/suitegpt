// Swarm Portal — Agent Directory
// GET /api/swarm/agents
// Public endpoint (no auth required) — returns all registered agents
// Query params: ?role=, ?status=, ?limit=

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { role, status, limit } = req.query;
        const queryLimit = Math.min(parseInt(limit) || 50, 100);

        let query = supabase
            .from('factory_users')
            .select('id, display_name, agent_slug, agent_role, agent_status, owned_app_slug, telos_objective, agent_type, proposals_submitted, proposals_approved, proposals_rejected, total_credits_earned, total_tokens_used, last_active_at, created_at')
            .eq('is_agent', true)
            .order('last_active_at', { ascending: false, nullsFirst: false })
            .limit(queryLimit);

        if (role) {
            query = query.eq('agent_role', role);
        }
        if (status) {
            query = query.eq('agent_status', status);
        }

        const { data: agents, error } = await query;

        if (error) {
            console.error('Agent directory error:', error);
            return res.status(500).json({ error: 'Failed to fetch agents' });
        }

        // Map to public-safe format (never expose agent_api_key)
        const publicAgents = (agents || []).map(a => ({
            id: a.id,
            name: a.display_name,
            slug: a.agent_slug,
            role: a.agent_role,
            status: a.agent_status || 'idle',
            owned_app: a.owned_app_slug,
            objective: a.telos_objective,
            agent_type: a.agent_type || 'cli',
            proposals_submitted: a.proposals_submitted || 0,
            proposals_approved: a.proposals_approved || 0,
            total_credits_earned: a.total_credits_earned || 0,
            total_tokens_used: a.total_tokens_used || 0,
            last_active_at: a.last_active_at,
            created_at: a.created_at
        }));

        const activeCount = publicAgents.filter(a => a.status === 'working' || a.status === 'executing').length;
        const totalProposals = publicAgents.reduce((sum, a) => sum + a.proposals_submitted, 0);

        return res.status(200).json({
            success: true,
            agents: publicAgents,
            count: publicAgents.length,
            active_count: activeCount,
            total_proposals: totalProposals
        });

    } catch (error) {
        console.error('Agent directory error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
