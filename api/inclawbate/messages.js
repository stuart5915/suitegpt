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

// Rate limit message sends per conversation
const msgRateMap = new Map();
const MSG_RATE_WINDOW = 60 * 1000; // 1 minute
const MSG_RATE_MAX = 20; // 20 messages per minute per conversation

function checkMsgRateLimit(conversationId) {
    const now = Date.now();
    const entry = msgRateMap.get(conversationId);
    if (!entry || now - entry.windowStart > MSG_RATE_WINDOW) {
        msgRateMap.set(conversationId, { windowStart: now, count: 1 });
        return true;
    }
    if (entry.count >= MSG_RATE_MAX) return false;
    entry.count++;
    return true;
}

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
            const { conversation_id, after, agent_address: agentAddressParam } = req.query;
            if (!conversation_id) {
                return res.status(400).json({ error: 'Missing conversation_id' });
            }

            // Auth: JWT required. Agent access also requires JWT now.
            const user = authenticateRequest(req);
            if (!user) {
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

            // Check authorization: human_id match OR any user wallet matches agent_address
            if (convo.human_id !== user.sub) {
                const { data: prof } = await supabase
                    .from('human_profiles')
                    .select('wallet_address, linked_wallets')
                    .eq('id', user.sub)
                    .single();
                const wallets = [];
                if (prof?.wallet_address) wallets.push(prof.wallet_address.toLowerCase());
                if (Array.isArray(prof?.linked_wallets)) {
                    prof.linked_wallets.forEach(w => wallets.push(w.toLowerCase()));
                }
                if (!wallets.includes(convo.agent_address)) {
                    return res.status(403).json({ error: 'Not your conversation' });
                }
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

            // Rate limit
            if (!checkMsgRateLimit(conversation_id)) {
                return res.status(429).json({ error: 'Too many messages. Slow down.' });
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

            // Verify sender authorization — JWT required for both human and agent
            const user = authenticateRequest(req);

            if (sender_type === 'human') {
                if (!user) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                // Allow if human_id matches OR any wallet matches agent_address (payer)
                if (convo.human_id !== user.sub) {
                    const { data: prof } = await supabase
                        .from('human_profiles')
                        .select('wallet_address, linked_wallets')
                        .eq('id', user.sub)
                        .single();
                    const wallets = [];
                    if (prof?.wallet_address) wallets.push(prof.wallet_address.toLowerCase());
                    if (Array.isArray(prof?.linked_wallets)) {
                        prof.linked_wallets.forEach(w => wallets.push(w.toLowerCase()));
                    }
                    if (!wallets.includes(convo.agent_address)) {
                        return res.status(403).json({ error: 'Not authorized' });
                    }
                }
            } else if (sender_type === 'agent') {
                // Require JWT — derive wallet from profile to verify ownership
                if (!user) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                const { data: prof } = await supabase
                    .from('human_profiles')
                    .select('wallet_address, linked_wallets')
                    .eq('id', user.sub)
                    .single();
                const wallets = [];
                if (prof?.wallet_address) wallets.push(prof.wallet_address.toLowerCase());
                if (Array.isArray(prof?.linked_wallets)) {
                    prof.linked_wallets.forEach(w => wallets.push(w.toLowerCase()));
                }
                if (!wallets.includes(convo.agent_address)) {
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

            // Notify payer via Telegram when human replies
            if (sender_type === 'human') {
                // Find the profile that owns the agent_address (primary or linked)
                const { data: payers } = await supabase
                    .from('human_profiles')
                    .select('telegram_chat_id, wallet_address, linked_wallets')
                    .not('telegram_chat_id', 'is', null);

                if (payers) {
                    const payer = payers.find(p => {
                        const wallets = [];
                        if (p.wallet_address) wallets.push(p.wallet_address.toLowerCase());
                        if (Array.isArray(p.linked_wallets)) {
                            p.linked_wallets.forEach(w => wallets.push(w.toLowerCase()));
                        }
                        return wallets.includes(convo.agent_address);
                    });

                    if (payer?.telegram_chat_id) {
                        // Get the human's name for the notification
                        const { data: sender } = await supabase
                            .from('human_profiles')
                            .select('x_name, x_handle')
                            .eq('id', convo.human_id)
                            .single();
                        const senderName = sender?.x_name || sender?.x_handle || 'Someone';
                        const preview = escHtml(content.trim().slice(0, 200));
                        await notifyHuman(payer.telegram_chat_id,
                            `💬 <b>Reply from ${escHtml(senderName)}</b>\n\n"${preview}"\n\n👉 inclawbate.com/dashboard`
                        );
                    }
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
