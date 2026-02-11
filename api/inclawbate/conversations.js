// Inclawbate — Conversations API
// GET   /api/inclawbate/conversations           — list conversations (authed human)
// GET   /api/inclawbate/conversations?id=xxx    — get single conversation with messages
// POST  /api/inclawbate/conversations           — create conversation (agent pays human)

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

    // GET — list conversations or get single with messages
    if (req.method === 'GET') {
        const user = authenticateRequest(req);
        if (!user) return res.status(401).json({ error: 'Authentication required' });

        try {
            const { id, status, direction } = req.query;

            // Look up user's wallet address (needed for outbound queries)
            let userWallet = null;
            if (direction === 'outbound' || id) {
                const { data: profile } = await supabase
                    .from('human_profiles')
                    .select('wallet_address')
                    .eq('id', user.sub)
                    .single();
                userWallet = profile?.wallet_address?.toLowerCase() || null;
            }

            // Single conversation with messages
            if (id) {
                // Allow access if human_id matches OR user's wallet matches agent_address
                let convo = null;
                const { data: c1 } = await supabase
                    .from('inclawbate_conversations')
                    .select('*')
                    .eq('id', id)
                    .eq('human_id', user.sub)
                    .single();
                convo = c1;

                if (!convo && userWallet) {
                    const { data: c2 } = await supabase
                        .from('inclawbate_conversations')
                        .select('*')
                        .eq('id', id)
                        .eq('agent_address', userWallet)
                        .single();
                    convo = c2;
                }

                if (!convo) {
                    return res.status(404).json({ error: 'Conversation not found' });
                }

                const { data: messages, error: msgErr } = await supabase
                    .from('inclawbate_messages')
                    .select('*')
                    .eq('conversation_id', id)
                    .order('created_at', { ascending: true });

                if (msgErr) {
                    return res.status(500).json({ error: 'Failed to fetch messages' });
                }

                return res.status(200).json({ conversation: convo, messages: messages || [] });
            }

            // Outbound: conversations where user is the payer (agent_address = wallet)
            if (direction === 'outbound') {
                if (!userWallet) {
                    return res.status(200).json({ conversations: [], total: 0 });
                }

                const { data: convos, count: outCount, error: outErr } = await supabase
                    .from('inclawbate_conversations')
                    .select('*', { count: 'exact' })
                    .eq('agent_address', userWallet)
                    .order('last_message_at', { ascending: false });

                if (outErr) {
                    return res.status(500).json({ error: 'Failed to fetch conversations' });
                }

                // Enrich with hired human's profile info
                const humanIds = [...new Set((convos || []).map(c => c.human_id))];
                let humanMap = {};
                if (humanIds.length > 0) {
                    const { data: humans } = await supabase
                        .from('human_profiles')
                        .select('id, x_handle, x_name, x_avatar_url')
                        .in('id', humanIds);
                    (humans || []).forEach(h => { humanMap[h.id] = h; });
                }

                const enriched = (convos || []).map(c => ({
                    ...c,
                    human_x_handle: humanMap[c.human_id]?.x_handle || null,
                    human_x_name: humanMap[c.human_id]?.x_name || null,
                    human_x_avatar_url: humanMap[c.human_id]?.x_avatar_url || null
                }));

                return res.status(200).json({ conversations: enriched, total: outCount || 0 });
            }

            // Default: list inbound conversations for this human
            let query = supabase
                .from('inclawbate_conversations')
                .select('*', { count: 'exact' })
                .eq('human_id', user.sub)
                .order('last_message_at', { ascending: false });

            if (status) {
                query = query.eq('status', status);
            }

            const { data, count, error } = await query;

            if (error) {
                return res.status(500).json({ error: 'Failed to fetch conversations' });
            }

            return res.status(200).json({ conversations: data || [], total: count || 0 });

        } catch (err) {
            // GET error
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — create a new conversation (agent hiring a human)
    if (req.method === 'POST') {
        try {
            const { human_handle, agent_address, agent_name, payment_amount, payment_tx, message } = req.body;

            if (!human_handle || !agent_address) {
                return res.status(400).json({ error: 'Missing human_handle or agent_address' });
            }

            if (!/^0x[0-9a-fA-F]{40}$/.test(agent_address)) {
                return res.status(400).json({ error: 'Invalid agent_address format' });
            }

            if (message && message.length > 10000) {
                return res.status(400).json({ error: 'Message too long (max 10,000 characters)' });
            }

            // Look up the human
            const { data: human, error: humanErr } = await supabase
                .from('human_profiles')
                .select('id, x_handle, x_name, telegram_chat_id')
                .eq('x_handle', human_handle.toLowerCase())
                .single();

            if (humanErr || !human) {
                return res.status(404).json({ error: 'Human not found' });
            }

            // Create conversation
            const { data: convo, error: convoErr } = await supabase
                .from('inclawbate_conversations')
                .insert({
                    human_id: human.id,
                    agent_address: agent_address.toLowerCase(),
                    agent_name: agent_name || `Agent ${agent_address.slice(0, 6)}`,
                    payment_amount: payment_amount || 0,
                    payment_tx: payment_tx || null
                })
                .select()
                .single();

            if (convoErr) {
                return res.status(500).json({ error: 'Failed to create conversation' });
            }

            // Increment hire count
            await supabase.rpc('increment_hire_count', { profile_id: human.id });

            // If initial message provided, insert it
            if (message) {
                await supabase
                    .from('inclawbate_messages')
                    .insert({
                        conversation_id: convo.id,
                        sender_type: 'agent',
                        content: message
                    });
            }

            // Auto-update human capacity: set to busy (fully allocated)
            await supabase
                .from('human_profiles')
                .update({
                    available_capacity: 0,
                    availability: 'busy',
                    updated_at: new Date().toISOString()
                })
                .eq('id', human.id);

            // Notify human via Telegram
            if (human.telegram_chat_id) {
                const amount = parseFloat(payment_amount) || 0;
                const agentLabel = escHtml(agent_name || `Agent ${agent_address.slice(0, 6)}...`);
                let text = `🦞 <b>New hire from ${agentLabel}</b>`;
                if (amount > 0) text += `\n💰 ${amount.toLocaleString()} CLAWNCH`;
                if (message) text += `\n\n"${escHtml(message.slice(0, 200))}"`;
                text += `\n\n👉 inclawbate.com/dashboard`;
                await notifyHuman(human.telegram_chat_id, text);
            }

            return res.status(201).json({ success: true, conversation: convo });

        } catch (err) {
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
