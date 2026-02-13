// Inclawbate — Batch Hire API (Admin)
// POST { tx_hash, agent_address, agent_name, recipients: [{handle, amount}], admin_secret }
// Creates conversation records for each recipient after a Disperse batch transfer

import { createClient } from '@supabase/supabase-js';

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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { tx_hash, agent_address, agent_name, recipients, starting_message } = req.body;

    // Admin auth — only the protocol wallet can create batch hires
    const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';
    if (!agent_address || agent_address.toLowerCase() !== ADMIN_WALLET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!tx_hash || !agent_address || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: 'tx_hash, agent_address, and recipients[] required' });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < recipients.length; i++) {
        const { handle, amount } = recipients[i];
        if (!handle) continue;

        try {
            // Look up human
            const { data: human, error: humanErr } = await supabase
                .from('human_profiles')
                .select('id, x_handle, wallet_address, airdrop_banned')
                .eq('x_handle', handle.toLowerCase())
                .single();

            if (humanErr || !human) {
                results.errors.push({ handle, error: 'Profile not found' });
                continue;
            }

            if (human.airdrop_banned) {
                results.errors.push({ handle, error: 'Account banned from airdrops' });
                continue;
            }

            // Use tx_hash + index for uniqueness (one Disperse tx = many hires)
            const uniqueTx = tx_hash + '_' + i;

            // Check duplicate
            const { data: existing } = await supabase
                .from('inclawbate_conversations')
                .select('id')
                .eq('payment_tx', uniqueTx)
                .single();

            if (existing) {
                results.skipped++;
                continue;
            }

            // Create conversation
            const { data: convo, error: convoErr } = await supabase
                .from('inclawbate_conversations')
                .insert({
                    human_id: human.id,
                    agent_address: agent_address.toLowerCase(),
                    agent_name: agent_name || 'inclawbate',
                    payment_amount: amount || 0,
                    payment_tx: uniqueTx
                })
                .select('id')
                .single();

            if (convoErr) {
                results.errors.push({ handle, error: convoErr.message });
                continue;
            }

            // Insert starting message if provided
            if (starting_message && convo?.id) {
                await supabase
                    .from('inclawbate_messages')
                    .insert({
                        conversation_id: convo.id,
                        sender_type: 'agent',
                        content: starting_message.trim()
                    });
            }

            // Increment hire count
            await supabase.rpc('increment_hire_count', { profile_id: human.id });

            // Mark as busy
            await supabase
                .from('human_profiles')
                .update({
                    available_capacity: 0,
                    availability: 'busy',
                    updated_at: new Date().toISOString()
                })
                .eq('id', human.id);

            results.created++;

        } catch (err) {
            results.errors.push({ handle, error: err.message });
        }
    }

    return res.status(200).json({
        success: true,
        ...results,
        total: recipients.length
    });
}
