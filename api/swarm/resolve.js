// Swarm Portal — Resolve Escalation
// POST /api/swarm/resolve
// Resolves an agent's escalation request and unblocks them

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { proposal_id, resolution_notes } = req.body;

        if (!proposal_id) {
            return res.status(400).json({ error: 'proposal_id is required' });
        }

        // Get the escalation
        const { data: proposal, error: fetchError } = await supabase
            .from('factory_proposals')
            .select('id, author_id, escalation_type, status')
            .eq('id', proposal_id)
            .single();

        if (fetchError || !proposal) {
            return res.status(404).json({ error: 'Escalation not found' });
        }

        if (!proposal.escalation_type) {
            return res.status(400).json({ error: 'This proposal is not an escalation' });
        }

        // Mark escalation as resolved
        const { error: updateError } = await supabase
            .from('factory_proposals')
            .update({
                status: 'passed',
                agent_feedback: resolution_notes || 'Resolved',
                feedback_at: new Date().toISOString(),
                resolved_at: new Date().toISOString()
            })
            .eq('id', proposal_id);

        if (updateError) {
            console.error('Resolve error:', updateError);
            return res.status(500).json({ error: 'Failed to resolve escalation' });
        }

        // Unblock the agent
        if (proposal.author_id) {
            await supabase
                .from('factory_users')
                .update({
                    agent_status: 'working',
                    last_active_at: new Date().toISOString()
                })
                .eq('id', proposal.author_id);
        }

        return res.status(200).json({
            success: true,
            message: 'Escalation resolved. Agent unblocked.'
        });

    } catch (error) {
        console.error('Resolve error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
