// Inclawbate — Hire Request
// POST → submit a hire request for an inclawbator, notify them via Telegram

import { createClient } from '@supabase/supabase-js';
import { notifyHuman, escHtml } from './notify.js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Council group chat — fallback when inclawbator has no TG
const COUNCIL_CHAT_ID = process.env.INCLAWBATE_COUNCIL_CHAT_ID || null;

const BUDGET_LABELS = {
    0: 'Let them quote',
    500: '500 CLAWS',
    1000: '1K CLAWS',
    2500: '2.5K CLAWS',
    5000: '5K CLAWS',
    10000: '10K CLAWS'
};

export default async function handler(req, res) {
    // Open CORS — external agents need to submit hire requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { target_wallet, description, budget_claws, contact } = req.body || {};

    // Validate
    if (!description || description.trim().length < 3) return res.status(400).json({ error: 'Description required' });
    if (description.trim().length > 500) return res.status(400).json({ error: 'Description too long (max 500)' });
    if (!contact || contact.trim().length < 2) return res.status(400).json({ error: 'Contact info required' });
    if (contact.trim().length > 100) return res.status(400).json({ error: 'Contact too long' });

    const desc = description.trim();
    const contactInfo = contact.trim();
    const budget = budget_claws ? parseInt(budget_claws) : 0;

    try {
        // Save hire request to DB
        const { data: hireReq, error: insertErr } = await supabase
            .from('hire_requests')
            .insert({
                target_wallet: target_wallet || 'council',
                description: desc,
                budget_claws: budget || null,
                requester_contact: contactInfo,
                status: 'pending'
            })
            .select('id')
            .single();

        if (insertErr) {
            console.error('Hire request insert error:', insertErr);
            return res.status(500).json({ error: 'Failed to save hire request' });
        }

        // Build notification message
        const budgetText = budget > 0 ? (BUDGET_LABELS[budget] || budget + ' CLAWS') : 'Let them quote';

        const msg = `🦞 <b>New council request</b>\n\n` +
            `${escHtml(desc)}\n\n` +
            `<b>Reach them:</b> ${escHtml(contactInfo)}`;

        // Notify the council group
        if (COUNCIL_CHAT_ID) {
            try {
                await notifyHuman(COUNCIL_CHAT_ID, msg);
            } catch (tgErr) {
                console.error('TG notification failed:', tgErr);
            }
        } else {
            console.warn('No INCLAWBATE_COUNCIL_CHAT_ID set — skipping TG notification');
        }

        return res.status(200).json({ success: true, id: hireReq.id });
    } catch (err) {
        console.error('Hire request error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
