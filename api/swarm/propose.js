// Swarm Portal — Submit Proposal / Escalation
// POST /api/swarm/propose
// Authenticated: API key in Authorization header
// Supports: proposals, work updates, escalations, completions

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
        .select('id, display_name, agent_slug, is_agent, agent_role')
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

        const {
            title,
            description,
            category,
            submission_type,
            escalation_type,
            escalation_urgency,
            what_agent_needs
        } = req.body;

        if (!title || title.trim().length < 5) {
            return res.status(400).json({ error: 'Title is required (min 5 characters)' });
        }

        if (!description || description.trim().length < 20) {
            return res.status(400).json({ error: 'Description is required (min 20 characters)' });
        }

        const validSubmissionTypes = ['proposal', 'small_telos_proposal', 'work_update', 'assistance_request', 'completion'];
        const type = validSubmissionTypes.includes(submission_type) ? submission_type : 'proposal';

        // Validate escalation fields if this is an assistance request
        if (type === 'assistance_request') {
            const validEscalationTypes = [
                'needs_db_access', 'needs_api_key', 'needs_human_decision',
                'needs_other_agent', 'blocked_by_error', 'needs_deployment', 'needs_credential'
            ];
            if (escalation_type && !validEscalationTypes.includes(escalation_type)) {
                return res.status(400).json({ error: 'Invalid escalation_type' });
            }
        }

        // Insert proposal
        const insertData = {
            title: title.trim(),
            content: description.trim(),
            author_id: agent.id,
            from_agent: true,
            category: type === 'small_telos_proposal' ? 'small_telos' : (category || 'feature'),
            status: 'submitted',
            submission_type: type
        };

        // Add escalation fields if present
        if (type === 'assistance_request') {
            insertData.escalation_type = escalation_type || 'needs_human_decision';
            insertData.escalation_urgency = escalation_urgency || 'medium';
            insertData.what_agent_needs = what_agent_needs || null;
        }

        const { data: proposal, error } = await supabase
            .from('factory_proposals')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Proposal insert error:', error);
            return res.status(500).json({ error: 'Failed to submit', detail: error.message || error.code || JSON.stringify(error) });
        }

        // Update agent status based on submission type
        let newAgentStatus = 'waiting';
        if (type === 'work_update') {
            newAgentStatus = 'working';
        } else if (type === 'completion') {
            newAgentStatus = 'idle';
        } else if (type === 'assistance_request') {
            newAgentStatus = 'blocked';
        }

        await supabase
            .from('factory_users')
            .update({
                last_proposal_id: proposal.id,
                agent_status: newAgentStatus,
                last_active_at: new Date().toISOString()
            })
            .eq('id', agent.id);

        // Increment proposals_submitted (best effort, don't block on failure)
        try {
            await supabase
                .from('factory_users')
                .update({ proposals_submitted: (agent.proposals_submitted || 0) + 1 })
                .eq('id', agent.id);
        } catch (_) { /* ignore */ }

        const messages = {
            proposal: 'Proposal submitted for governance review',
            small_telos_proposal: 'Small Telos proposal submitted — waiting for approval',
            work_update: 'Work update logged',
            assistance_request: 'Escalation submitted — waiting for help',
            completion: 'Task marked complete'
        };

        return res.status(200).json({
            success: true,
            proposal_id: proposal.id,
            submission_type: type,
            message: messages[type]
        });

    } catch (error) {
        console.error('Propose error:', error);
        return res.status(500).json({ error: 'Server error', detail: error.message || String(error) });
    }
}
