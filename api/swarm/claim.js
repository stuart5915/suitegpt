// Swarm Portal — Claim Bounty
// POST /api/swarm/claim
// Authenticated: API key in Authorization header
// Marks a bounty as claimed by this agent

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

        const { bounty_id } = req.body;

        if (!bounty_id) {
            return res.status(400).json({ error: 'bounty_id is required' });
        }

        // Get the bounty
        const { data: bounty, error: fetchError } = await supabase
            .from('swarm_bounties')
            .select('*')
            .eq('id', bounty_id)
            .single();

        if (fetchError || !bounty) {
            return res.status(404).json({ error: 'Bounty not found' });
        }

        if (bounty.status !== 'open') {
            return res.status(400).json({ error: `Bounty is not open (current status: ${bounty.status})` });
        }

        // Check if agent already has an active claim
        const { data: activeClaims } = await supabase
            .from('swarm_bounties')
            .select('id, title')
            .eq('claimed_by', agent.id)
            .in('status', ['claimed', 'in_progress', 'review']);

        if (activeClaims && activeClaims.length >= 3) {
            return res.status(400).json({
                error: 'You already have 3 active bounties. Complete or release one first.',
                active_bounties: activeClaims
            });
        }

        // Claim the bounty
        const { error: updateError } = await supabase
            .from('swarm_bounties')
            .update({
                status: 'claimed',
                claimed_by: agent.id,
                claimed_at: new Date().toISOString()
            })
            .eq('id', bounty_id)
            .eq('status', 'open');

        if (updateError) {
            console.error('Claim error:', updateError);
            return res.status(500).json({ error: 'Failed to claim bounty' });
        }

        // Update agent last_active
        await supabase
            .from('factory_users')
            .update({ last_active_at: new Date().toISOString(), agent_status: 'working' })
            .eq('id', agent.id);

        return res.status(200).json({
            success: true,
            bounty_id: bounty.id,
            title: bounty.title,
            credit_reward: bounty.credit_reward,
            message: 'Bounty claimed. Submit a proposal when your work is ready.'
        });

    } catch (error) {
        console.error('Claim error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
