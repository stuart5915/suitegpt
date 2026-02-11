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

// Simple in-memory rate limiter (resets on cold start, good enough for serverless)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // 5 conversations per IP per hour

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { windowStart: now, count: 1 });
        return true;
    }
    if (entry.count >= RATE_LIMIT_MAX) return false;
    entry.count++;
    return true;
}

// Verify payment tx on Base via public RPC
const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'.toLowerCase();
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

async function verifyPaymentTx(txHash, expectedFrom, expectedTo, expectedAmount) {
    try {
        const resp = await fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1,
                method: 'eth_getTransactionReceipt',
                params: [txHash]
            })
        });
        const { result: receipt } = await resp.json();
        if (!receipt || receipt.status !== '0x1') return { valid: false, reason: 'Transaction failed or not found' };

        // Find ERC-20 Transfer event from the CLAWNCH contract
        const transferLog = (receipt.logs || []).find(log =>
            log.address.toLowerCase() === CLAWNCH_ADDRESS &&
            log.topics[0] === ERC20_TRANSFER_TOPIC
        );
        if (!transferLog) return { valid: false, reason: 'No CLAWNCH transfer found in transaction' };

        const from = '0x' + transferLog.topics[1].slice(26).toLowerCase();
        const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
        const amount = Number(BigInt(transferLog.data)) / 1e18;

        if (to.toLowerCase() !== expectedTo.toLowerCase()) {
            return { valid: false, reason: 'Payment was not sent to the correct wallet' };
        }

        // Allow some tolerance on amount (in case of rounding)
        if (expectedAmount > 0 && amount < expectedAmount * 0.99) {
            return { valid: false, reason: `Payment amount too low: ${amount} vs expected ${expectedAmount}` };
        }

        return { valid: true, from, to, amount };
    } catch (err) {
        console.error('Payment verification error:', err);
        // Don't block if RPC is down — log and allow with warning
        return { valid: true, warning: 'Could not verify on-chain, RPC unavailable' };
    }
}

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

            // Look up user's wallets (primary + linked)
            let allWallets = [];
            if (direction === 'outbound' || id) {
                const { data: profile } = await supabase
                    .from('human_profiles')
                    .select('wallet_address, linked_wallets')
                    .eq('id', user.sub)
                    .single();
                if (profile?.wallet_address) allWallets.push(profile.wallet_address.toLowerCase());
                if (Array.isArray(profile?.linked_wallets)) {
                    profile.linked_wallets.forEach(w => {
                        const lower = w.toLowerCase();
                        if (!allWallets.includes(lower)) allWallets.push(lower);
                    });
                }
            }

            // Single conversation with messages
            if (id) {
                // Allow access if human_id matches OR any user wallet matches agent_address
                let convo = null;
                const { data: c1 } = await supabase
                    .from('inclawbate_conversations')
                    .select('*')
                    .eq('id', id)
                    .eq('human_id', user.sub)
                    .single();
                convo = c1;

                if (!convo && allWallets.length > 0) {
                    for (const w of allWallets) {
                        const { data: c2 } = await supabase
                            .from('inclawbate_conversations')
                            .select('*')
                            .eq('id', id)
                            .eq('agent_address', w)
                            .single();
                        if (c2) { convo = c2; break; }
                    }
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

            // Outbound: conversations where user is the payer (agent_address matches any wallet)
            if (direction === 'outbound') {
                if (allWallets.length === 0) {
                    return res.status(200).json({ conversations: [], total: 0 });
                }

                const { data: convos, count: outCount, error: outErr } = await supabase
                    .from('inclawbate_conversations')
                    .select('*', { count: 'exact' })
                    .in('agent_address', allWallets)
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
        // Rate limit by IP
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
        if (!checkRateLimit(ip)) {
            return res.status(429).json({ error: 'Too many requests. Try again later.' });
        }

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

            // Require payment_tx for conversation creation
            if (!payment_tx || !/^0x[0-9a-fA-F]{64}$/.test(payment_tx)) {
                return res.status(400).json({ error: 'Valid payment_tx hash required' });
            }

            // Look up the human
            const { data: human, error: humanErr } = await supabase
                .from('human_profiles')
                .select('id, x_handle, x_name, telegram_chat_id, wallet_address')
                .eq('x_handle', human_handle.toLowerCase())
                .single();

            if (humanErr || !human) {
                return res.status(404).json({ error: 'Human not found' });
            }

            // Verify payment on-chain
            if (human.wallet_address) {
                const verification = await verifyPaymentTx(
                    payment_tx,
                    agent_address,
                    human.wallet_address,
                    parseFloat(payment_amount) || 0
                );
                if (!verification.valid) {
                    return res.status(400).json({ error: verification.reason });
                }
            }

            // Check for duplicate tx hash
            const { data: existingTx } = await supabase
                .from('inclawbate_conversations')
                .select('id')
                .eq('payment_tx', payment_tx)
                .single();

            if (existingTx) {
                return res.status(409).json({ error: 'This transaction has already been used' });
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
