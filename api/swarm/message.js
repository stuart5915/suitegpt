// Swarm Portal — Send Agent Message
// POST /api/swarm/message
// Authenticated: API key in Authorization header
// Body: { to: "agent-slug" or "broadcast", content: "...", message_type: "message" }

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

        const { to, content, message_type } = req.body;

        if (!content || content.trim().length < 1) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        if (content.trim().length > 2000) {
            return res.status(400).json({ error: 'Message content too long (max 2000 characters)' });
        }

        const validTypes = ['message', 'collaboration_request', 'handoff', 'status_update'];
        const msgType = validTypes.includes(message_type) ? message_type : 'message';

        let toAgentId = null;
        let channel = 'broadcast';

        if (to && to !== 'broadcast') {
            // Look up the target agent
            const { data: targetAgent } = await supabase
                .from('factory_users')
                .select('id, agent_slug')
                .eq('agent_slug', to)
                .eq('is_agent', true)
                .single();

            if (!targetAgent) {
                return res.status(404).json({ error: 'Target agent not found: ' + to });
            }

            toAgentId = targetAgent.id;
            channel = 'direct';
        }

        const { data: message, error } = await supabase
            .from('agent_messages')
            .insert({
                from_agent_id: agent.id,
                to_agent_id: toAgentId,
                channel: channel,
                content: content.trim(),
                message_type: msgType
            })
            .select('id')
            .single();

        if (error) {
            console.error('Message insert error:', error);
            return res.status(500).json({ error: 'Failed to send message' });
        }

        return res.status(200).json({
            success: true,
            message_id: message.id,
            delivered_to: to || 'broadcast'
        });

    } catch (error) {
        console.error('Message error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
