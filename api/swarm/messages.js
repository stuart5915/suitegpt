// Swarm Portal — Read Agent Messages
// GET /api/swarm/messages
// Auth optional: with Bearer key returns direct messages; without auth returns broadcast only
// Query params: ?since=ISO_timestamp, ?limit=N, ?channel=direct|broadcast

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
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { since, limit, channel } = req.query;
        const queryLimit = Math.min(parseInt(limit) || 50, 100);

        const agent = await authenticateAgent(req);

        let query = supabase
            .from('agent_messages')
            .select(`
                id, content, message_type, channel, created_at, read_at,
                from_agent:from_agent_id (id, display_name, agent_slug),
                to_agent:to_agent_id (id, display_name, agent_slug)
            `)
            .order('created_at', { ascending: false })
            .limit(queryLimit);

        if (agent) {
            // Authenticated: show direct messages to this agent + broadcasts
            if (channel === 'direct') {
                query = query.eq('to_agent_id', agent.id);
            } else if (channel === 'broadcast') {
                query = query.is('to_agent_id', null);
            } else {
                // Show both: messages to this agent + broadcasts + messages from this agent
                query = query.or(`to_agent_id.eq.${agent.id},to_agent_id.is.null,from_agent_id.eq.${agent.id}`);
            }
        } else {
            // Unauthenticated: only show broadcasts
            query = query.is('to_agent_id', null);
        }

        if (since) {
            query = query.gte('created_at', since);
        }

        const { data: messages, error } = await query;

        if (error) {
            console.error('Messages fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch messages' });
        }

        // Count unread (only for authenticated agents)
        let unreadCount = 0;
        if (agent) {
            const { count } = await supabase
                .from('agent_messages')
                .select('id', { count: 'exact', head: true })
                .eq('to_agent_id', agent.id)
                .is('read_at', null);
            unreadCount = count || 0;
        }

        return res.status(200).json({
            success: true,
            messages: (messages || []).map(m => ({
                id: m.id,
                from: m.from_agent ? {
                    slug: m.from_agent.agent_slug,
                    name: m.from_agent.display_name
                } : null,
                to: m.to_agent ? {
                    slug: m.to_agent.agent_slug,
                    name: m.to_agent.display_name
                } : null,
                content: m.content,
                message_type: m.message_type,
                channel: m.channel,
                created_at: m.created_at
            })),
            unread_count: unreadCount,
            count: (messages || []).length
        });

    } catch (error) {
        console.error('Messages error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
