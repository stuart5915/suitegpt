// Inclawbate — Messages API
// GET  /api/inclawbate/messages?conversation_id=xxx — get messages (authed human or agent)
// POST /api/inclawbate/messages                     — send a message

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';
import { notifyHuman, escHtml } from './notify.js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET — fetch messages for a conversation
    if (req.method === 'GET') {
        try {
            const { conversation_id, after } = req.query;
            if (!conversation_id) {
                return res.status(400).json({ error: 'Missing conversation_id' });
            }

            // Auth: either human (JWT) or agent (by address in query)
            const user = authenticateRequest(req);
            const agentAddress = req.query.agent_address;

            if (!user && !agentAddress) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Verify access to this conversation
            const { data: convo } = await supabase
                .from('inclawbate_conversations')
                .select('id, human_id, agent_address')
                .eq('id', conversation_id)
                .single();

            if (!convo) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Check authorization
            if (user && convo.human_id !== user.sub) {
                return res.status(403).json({ error: 'Not your conversation' });
            }
            if (agentAddress && convo.agent_address !== agentAddress.toLowerCase()) {
                return res.status(403).json({ error: 'Not your conversation' });
            }

            let query = supabase
                .from('inclawbate_messages')
                .select('*')
                .eq('conversation_id', conversation_id)
                .order('created_at', { ascending: true });

            // Polling: only get messages after a timestamp
            if (after) {
                query = query.gt('created_at', after);
            }

            const { data, error } = await query;

            if (error) {
                return res.status(500).json({ error: 'Failed to fetch messages' });
            }

            return res.status(200).json({ messages: data || [] });

        } catch (err) {
            // GET error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — send a message
    if (req.method === 'POST') {
        try {
            const { conversation_id, content, sender_type, agent_address } = req.body;

            if (!conversation_id || !content || !sender_type) {
                return res.status(400).json({ error: 'Missing conversation_id, content, or sender_type' });
            }

            if (!['agent', 'human'].includes(sender_type)) {
                return res.status(400).json({ error: 'sender_type must be agent or human' });
            }

            if (content.length > 10000) {
                return res.status(400).json({ error: 'Message too long (max 10,000 characters)' });
            }

            // Verify conversation exists
            const { data: convo } = await supabase
                .from('inclawbate_conversations')
                .select('id, human_id, agent_address, status')
                .eq('id', conversation_id)
                .single();

            if (!convo) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            if (convo.status !== 'active') {
                return res.status(400).json({ error: 'Conversation is not active' });
            }

            // Verify sender authorization
            if (sender_type === 'human') {
                const user = authenticateRequest(req);
                if (!user || convo.human_id !== user.sub) {
                    return res.status(403).json({ error: 'Not authorized' });
                }
            } else if (sender_type === 'agent') {
                if (!agent_address || convo.agent_address !== agent_address.toLowerCase()) {
                    return res.status(403).json({ error: 'Not authorized' });
                }
            }

            // Insert message
            const { data: msg, error } = await supabase
                .from('inclawbate_messages')
                .insert({
                    conversation_id,
                    sender_type,
                    content: content.trim()
                })
                .select()
                .single();

            if (error) {
                return res.status(500).json({ error: 'Failed to send message' });
            }

            // Notify human via Telegram when agent sends a message
            if (sender_type === 'agent') {
                const { data: human } = await supabase
                    .from('human_profiles')
                    .select('telegram_chat_id')
                    .eq('id', convo.human_id)
                    .single();

                if (human?.telegram_chat_id) {
                    const preview = escHtml(content.trim().slice(0, 200));
                    await notifyHuman(human.telegram_chat_id,
                        `💬 <b>New message</b>\n\n"${preview}"\n\n👉 inclawbate.com/dashboard`
                    );
                }
            }

            return res.status(201).json({ success: true, message: msg });

        } catch (err) {
            // POST error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
