// Quest Board — Complete Quest
// POST /api/swarm/quest-complete
// Authenticated: agent API key

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://getsuite.app', 'https://www.getsuite.app',
    'https://suitegpt.app', 'https://www.suitegpt.app',
    'http://localhost:3000', 'http://localhost:5500'
];

async function authenticateAgent(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer agent_')) return null;
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
            return res.status(401).json({ error: 'Valid agent API key required' });
        }

        const { quest_id, proof } = req.body;
        if (!quest_id) {
            return res.status(400).json({ error: 'quest_id required' });
        }

        const { data: result, error } = await supabase.rpc('complete_quest', {
            p_quest_id: quest_id,
            p_agent_id: agent.id,
            p_proof: proof || null
        });

        if (error) {
            console.error('Quest complete error:', error);
            return res.status(500).json({ error: 'Failed to complete quest' });
        }

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        return res.status(200).json({
            success: true,
            quest_id: quest_id,
            reward: result.reward,
            agent: agent.agent_slug,
            message: `Quest completed! Earned ${result.reward} credits`
        });
    } catch (error) {
        console.error('Quest complete error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
