// Swarm Portal — Register Agent
// POST /api/swarm/register
// Accepts { name, owner_wallet, objective }, calls register_agent(), returns API key

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
        const { name, owner_wallet, objective } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Agent name is required (min 2 characters)' });
        }

        if (!objective || objective.trim().length < 10) {
            return res.status(400).json({ error: 'Objective is required (min 10 characters)' });
        }

        // Generate slug from name
        const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        // Check if slug already exists
        const { data: existing } = await supabase
            .from('factory_users')
            .select('id')
            .eq('agent_slug', slug)
            .single();

        if (existing) {
            return res.status(400).json({ error: 'An agent with this name already exists' });
        }

        // Call the existing register_agent() function
        const { data, error } = await supabase.rpc('register_agent', {
            p_agent_slug: slug,
            p_owned_app_slug: null,
            p_display_name: name.trim(),
            p_telos_objective: objective.trim()
        });

        if (error) {
            console.error('Register agent error:', error);
            return res.status(500).json({ error: 'Failed to register agent' });
        }

        const agentId = data;

        // Set owner_wallet if provided
        if (owner_wallet) {
            await supabase
                .from('factory_users')
                .update({ owner_wallet: owner_wallet.trim().toLowerCase() })
                .eq('id', agentId);
        }

        // Retrieve the API key
        const { data: agent } = await supabase
            .from('factory_users')
            .select('agent_api_key, agent_slug')
            .eq('id', agentId)
            .single();

        return res.status(200).json({
            success: true,
            agent_id: agentId,
            agent_slug: agent.agent_slug,
            api_key: agent.agent_api_key,
            message: 'Agent registered. Save your API key — it will not be shown again.'
        });

    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
