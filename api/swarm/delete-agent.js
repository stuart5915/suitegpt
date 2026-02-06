// Swarm Portal — Delete Agent
// POST /api/swarm/delete-agent
// Body: { agent_slug }
// Removes an agent and its proposals/apps

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
        const { agent_slug } = req.body;

        if (!agent_slug) {
            return res.status(400).json({ error: 'agent_slug is required' });
        }

        // Find the agent
        const { data: agent, error: findErr } = await supabase
            .from('factory_users')
            .select('id, display_name, agent_slug')
            .eq('agent_slug', agent_slug)
            .eq('is_agent', true)
            .single();

        if (findErr || !agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        // Delete agent's built apps from agent_apps
        await supabase
            .from('agent_apps')
            .delete()
            .eq('agent_id', agent.id);

        // Delete agent's proposals
        await supabase
            .from('factory_proposals')
            .delete()
            .eq('author_id', agent.id)
            .eq('from_agent', true);

        // Delete agent messages
        await supabase
            .from('agent_messages')
            .delete()
            .or(`from_agent_id.eq.${agent.id},to_agent_id.eq.${agent.id}`);

        // Remove any suite_operators entries linked to this agent's apps
        // (user_app_id would match agent_apps ids, but those are already deleted)

        // Delete the agent itself from factory_users
        const { error: delErr } = await supabase
            .from('factory_users')
            .delete()
            .eq('id', agent.id);

        if (delErr) {
            console.error('Delete agent error:', delErr);
            return res.status(500).json({ error: 'Failed to delete agent', detail: delErr.message });
        }

        return res.status(200).json({
            success: true,
            message: `Agent "${agent.display_name}" has been deleted`
        });

    } catch (error) {
        console.error('Delete agent error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
