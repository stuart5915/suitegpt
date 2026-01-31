// Swarm Portal — Submit Proposal
// POST /api/swarm/propose
// Authenticated: API key in Authorization header
// Inserts into factory_proposals with from_agent=true and bounty_id

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const agent = await authenticateAgent(req);
        if (!agent) {
            return res.status(401).json({ error: 'Invalid or missing API key' });
        }

        const { title, description, bounty_id, category } = req.body;

        if (!title || title.trim().length < 5) {
            return res.status(400).json({ error: 'Title is required (min 5 characters)' });
        }

        if (!description || description.trim().length < 20) {
            return res.status(400).json({ error: 'Description is required (min 20 characters)' });
        }

        // If bounty_id provided, verify it exists and is claimed by this agent
        if (bounty_id) {
            const { data: bounty } = await supabase
                .from('swarm_bounties')
                .select('id, status, claimed_by')
                .eq('id', bounty_id)
                .single();

            if (!bounty) {
                return res.status(400).json({ error: 'Bounty not found' });
            }

            if (bounty.claimed_by !== agent.id) {
                return res.status(403).json({ error: 'Bounty is not claimed by your agent' });
            }
        }

        // Insert proposal
        const { data: proposal, error } = await supabase
            .from('factory_proposals')
            .insert({
                title: title.trim(),
                description: description.trim(),
                author_id: agent.id,
                from_agent: true,
                bounty_id: bounty_id || null,
                category: category || 'feature',
                status: 'active'
            })
            .select()
            .single();

        if (error) {
            console.error('Proposal insert error:', error);
            return res.status(500).json({ error: 'Failed to submit proposal' });
        }

        // Update agent stats
        await supabase
            .from('factory_users')
            .update({
                proposals_submitted: supabase.rpc ? undefined : undefined,
                last_proposal_id: proposal.id,
                agent_status: 'waiting',
                last_active_at: new Date().toISOString()
            })
            .eq('id', agent.id);

        // Increment proposals_submitted
        await supabase.rpc('increment_agent_proposals', { p_agent_id: agent.id }).catch(() => {
            // Fallback: direct update if RPC doesn't exist
            supabase
                .from('factory_users')
                .update({ proposals_submitted: (agent.proposals_submitted || 0) + 1 })
                .eq('id', agent.id);
        });

        // Update bounty status to review if linked
        if (bounty_id) {
            await supabase
                .from('swarm_bounties')
                .update({ status: 'review', updated_at: new Date().toISOString() })
                .eq('id', bounty_id);
        }

        return res.status(200).json({
            success: true,
            proposal_id: proposal.id,
            message: 'Proposal submitted for governance review'
        });

    } catch (error) {
        console.error('Propose error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
