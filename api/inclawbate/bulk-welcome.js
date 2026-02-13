// Inclawbate — Bulk Welcome Message API (Admin)
// POST { wallet_address, message }
// Sends a welcome message to all humans who have no conversation yet

import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const ADMIN_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

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

    const { wallet_address, message } = req.body;

    if (!wallet_address || wallet_address.toLowerCase() !== ADMIN_WALLET) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        // Get all human IDs that already have a conversation
        const { data: existingConvos, error: convoErr } = await supabase
            .from('inclawbate_conversations')
            .select('human_id');

        if (convoErr) {
            return res.status(500).json({ error: 'Failed to fetch conversations: ' + convoErr.message });
        }

        const humansWithConvo = new Set((existingConvos || []).map(c => c.human_id));

        // Get all humans with a wallet
        let allHumans = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data: batch, error: humanErr } = await supabase
                .from('human_profiles')
                .select('id, x_handle')
                .not('wallet_address', 'is', null)
                .range(offset, offset + limit - 1);

            if (humanErr) {
                return res.status(500).json({ error: 'Failed to fetch humans: ' + humanErr.message });
            }

            allHumans.push(...(batch || []));
            hasMore = (batch || []).length === limit;
            offset += limit;
        }

        // Filter to only those without conversations
        const unmessaged = allHumans.filter(h => !humansWithConvo.has(h.id));

        if (unmessaged.length === 0) {
            return res.status(200).json({ success: true, sent: 0, message: 'All humans already have conversations' });
        }

        let sent = 0;
        const errors = [];

        for (const human of unmessaged) {
            try {
                // Create conversation
                const { data: convo, error: createErr } = await supabase
                    .from('inclawbate_conversations')
                    .insert({
                        human_id: human.id,
                        agent_address: ADMIN_WALLET,
                        agent_name: 'inclawbate',
                        payment_amount: 0,
                        payment_tx: 'welcome_' + human.id
                    })
                    .select('id')
                    .single();

                if (createErr) {
                    errors.push({ handle: human.x_handle, error: createErr.message });
                    continue;
                }

                // Insert welcome message
                const { error: msgErr } = await supabase
                    .from('inclawbate_messages')
                    .insert({
                        conversation_id: convo.id,
                        sender_type: 'agent',
                        content: message.trim()
                    });

                if (msgErr) {
                    errors.push({ handle: human.x_handle, error: msgErr.message });
                    continue;
                }

                sent++;
            } catch (err) {
                errors.push({ handle: human.x_handle, error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            sent,
            total_unmessaged: unmessaged.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
