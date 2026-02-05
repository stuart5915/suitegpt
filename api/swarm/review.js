// Swarm Portal — Review Agent Proposal
// POST /api/swarm/review
// Body: { proposal_id, decision: "passed"|"rejected", feedback? }
// Uses service role key to bypass RLS

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
        const { proposal_id, decision, feedback } = req.body;

        if (!proposal_id) {
            return res.status(400).json({ error: 'proposal_id is required' });
        }
        if (!decision || !['passed', 'rejected'].includes(decision)) {
            return res.status(400).json({ error: 'decision must be "passed" or "rejected"' });
        }

        // Get the proposal
        const { data: proposal, error: fetchError } = await supabase
            .from('factory_proposals')
            .select('id, author_id, title, status')
            .eq('id', proposal_id)
            .single();

        if (fetchError || !proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        if (proposal.status !== 'submitted') {
            return res.status(400).json({ error: 'Proposal already resolved: ' + proposal.status });
        }

        // Update proposal
        const updateData = {
            status: decision,
            feedback_at: new Date().toISOString()
        };
        if (decision === 'passed') {
            updateData.resolved_at = new Date().toISOString();
        }
        if (feedback) {
            updateData.agent_feedback = feedback;
        }

        const { error: updateError } = await supabase
            .from('factory_proposals')
            .update(updateData)
            .eq('id', proposal_id);

        if (updateError) {
            console.error('Review update error:', updateError);
            return res.status(500).json({ error: 'Failed to update proposal' });
        }

        // Update agent status
        if (proposal.author_id) {
            const newStatus = decision === 'passed' ? 'working' : 'idle';
            await supabase
                .from('factory_users')
                .update({
                    agent_status: newStatus,
                    last_active_at: new Date().toISOString()
                })
                .eq('id', proposal.author_id);

            // Increment approved count if passed
            if (decision === 'passed') {
                const { data: agent } = await supabase
                    .from('factory_users')
                    .select('proposals_approved')
                    .eq('id', proposal.author_id)
                    .single();
                await supabase
                    .from('factory_users')
                    .update({ proposals_approved: (agent?.proposals_approved || 0) + 1 })
                    .eq('id', proposal.author_id);
            }
        }

        return res.status(200).json({
            success: true,
            decision,
            proposal_title: proposal.title,
            message: decision === 'passed'
                ? 'Proposal approved — agent is now working'
                : 'Proposal rejected — agent idle'
        });

    } catch (error) {
        console.error('Review error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
