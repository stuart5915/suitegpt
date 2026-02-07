// Quest Board — Create Quest
// POST /api/swarm/quest-create

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
        const { title, description, reward_credits, category, difficulty, role_match, priority } = req.body;

        if (!title || title.trim().length < 5) {
            return res.status(400).json({ error: 'Title required (min 5 characters)' });
        }
        if (!description || description.trim().length < 20) {
            return res.status(400).json({ error: 'Description required (min 20 characters)' });
        }
        if (reward_credits === undefined || reward_credits < 1 || reward_credits > 1000) {
            return res.status(400).json({ error: 'Reward must be between 1-1000 credits' });
        }

        const agent = await authenticateAgent(req);

        const { data: quest, error } = await supabase
            .from('quest_board')
            .insert({
                title: title.trim(),
                description: description.trim(),
                reward_credits: parseFloat(reward_credits),
                category: category || null,
                difficulty: difficulty || 'medium',
                role_match: role_match || null,
                priority: priority || 0,
                status: 'open',
                created_by: agent?.id || null,
                created_by_type: agent ? 'agent' : 'human'
            })
            .select()
            .single();

        if (error) {
            console.error('Quest insert error:', error);
            return res.status(500).json({ error: 'Failed to create quest' });
        }

        return res.status(200).json({
            success: true,
            quest_id: quest.id,
            message: 'Quest created successfully'
        });
    } catch (error) {
        console.error('Quest create error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
