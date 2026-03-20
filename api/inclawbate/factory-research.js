// Inclawbate — Factory Research Log
// GET → list research logs, POST → save new research

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
];

const COUNCIL = new Set([
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
    '0x18b18e245122f4bda5f2ee4f25c702e05c241d49',
    '0x496f68438493eb1cc632f7cec6634f042c95e333',
    '0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3',
    '0xc2599f1009669f4cda7ac2493de06d450fc79ef9'
]);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const wallet = (req.query.wallet || req.body?.wallet || '').toLowerCase();
    if (!wallet || !COUNCIL.has(wallet)) {
        return res.status(403).json({ error: 'Council access only' });
    }

    // GET — list all research logs
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('factory_research_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Research log list error:', error);
                return res.status(500).json({ error: 'Failed to load research logs' });
            }

            return res.status(200).json({ logs: data || [] });
        } catch (err) {
            console.error('Research GET error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — save new research
    if (req.method === 'POST') {
        const { conclusions, picked_idea, pick_reason } = req.body || {};
        if (!conclusions || conclusions.trim().length < 10) {
            return res.status(400).json({ error: 'Research conclusions required (min 10 chars)' });
        }

        try {
            const { data, error } = await supabase
                .from('factory_research_logs')
                .insert({
                    conclusions: conclusions.trim().slice(0, 20000),
                    picked_idea: picked_idea ? picked_idea.trim().slice(0, 120) : null,
                    pick_reason: pick_reason ? pick_reason.trim().slice(0, 200) : null,
                    created_by: wallet
                })
                .select('*')
                .single();

            if (error) {
                console.error('Research insert error:', error);
                return res.status(500).json({ error: 'Failed to save research' });
            }

            return res.status(200).json({ success: true, log: data });
        } catch (err) {
            console.error('Research POST error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
