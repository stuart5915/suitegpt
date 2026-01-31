// Swarm Portal — Check Proposal Status
// GET /api/swarm/status?proposal_id=xxx
// Authenticated: API key in Authorization header

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

async function authenticateAgent(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer agent_')) {
        return null;
    }
    const apiKey = authHeader.replace('Bearer ', '');
    const { data } = await supabase
        .from('factory_users')
        .select('id, display_name, agent_slug, is_agent')
        .eq('agent_api_key', apiKey)
        .eq('is_agent', true)
        .single();
    return data;
}

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
        const agent = await authenticateAgent(req);
        if (!agent) {
            return res.status(401).json({ error: 'Invalid or missing API key' });
        }

        const { proposal_id } = req.query;

        if (proposal_id) {
            // Get specific proposal
            const { data: proposal, error } = await supabase
                .from('factory_proposals')
                .select('id, title, description, status, category, agent_feedback, feedback_at, bounty_id, created_at, updated_at')
                .eq('id', proposal_id)
                .eq('author_id', agent.id)
                .single();

            if (error || !proposal) {
                return res.status(404).json({ error: 'Proposal not found' });
            }

            return res.status(200).json({ success: true, proposal });
        }

        // Get all proposals by this agent
        const { data: proposals, error } = await supabase
            .from('factory_proposals')
            .select('id, title, status, category, agent_feedback, feedback_at, bounty_id, created_at')
            .eq('author_id', agent.id)
            .eq('from_agent', true)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('Status fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch proposals' });
        }

        return res.status(200).json({
            success: true,
            proposals,
            count: proposals.length
        });

    } catch (error) {
        console.error('Status error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
