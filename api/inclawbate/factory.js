// Inclawbate — App Factory Pipeline
// GET → list pipelines, POST → create, PATCH → update step

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const COUNCIL = new Set([
    '0x91b5c0d07859cfeafeb67d9694121cd741f049bd',
    '0x18b18e245122f4bda5f2ee4f25c702e05c241d49',
    '0x496f68438493eb1cc632f7cec6634f042c95e333',
    '0x3392f862de3a2918c774cdc5c1662e2c02b9e5a3',
    '0xc2599f1009669f4cda7ac2493de06d450fc79ef9'
]);

const STEP_KEYS = ['step_app', 'step_token', 'step_pool', 'step_buy', 'step_stake', 'step_fund', 'step_tweet', 'step_poll'];

function isCouncil(wallet) {
    return wallet && COUNCIL.has(wallet.toLowerCase());
}

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Auth: council wallet required
    const wallet = (req.query.wallet || req.body?.wallet || '').toLowerCase();
    if (!isCouncil(wallet)) {
        return res.status(403).json({ error: 'Council access only' });
    }

    // GET — list all pipelines
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('app_factory_pipelines')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Factory list error:', error);
                return res.status(500).json({ error: 'Failed to load pipelines' });
            }

            return res.status(200).json({ pipelines: data || [] });
        } catch (err) {
            console.error('Factory GET error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST — create new pipeline
    if (req.method === 'POST') {
        const { app_name, app_description, token_symbol } = req.body || {};
        if (!app_name || app_name.trim().length < 2) {
            return res.status(400).json({ error: 'App name required (min 2 chars)' });
        }

        try {
            const { data, error } = await supabase
                .from('app_factory_pipelines')
                .insert({
                    app_name: app_name.trim().slice(0, 60),
                    app_description: (app_description || '').trim().slice(0, 200),
                    token_symbol: (token_symbol || '').trim().slice(0, 10) || null,
                    created_by: wallet
                })
                .select('*')
                .single();

            if (error) {
                console.error('Factory insert error:', error);
                return res.status(500).json({ error: 'Failed to create pipeline' });
            }

            return res.status(200).json({ success: true, pipeline: data });
        } catch (err) {
            console.error('Factory POST error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    // PATCH — update pipeline step or fields
    if (req.method === 'PATCH') {
        const { id } = req.body || {};
        if (!id) return res.status(400).json({ error: 'Pipeline id required' });

        const updates = {};

        // Step toggles
        STEP_KEYS.forEach(key => {
            if (req.body[key] !== undefined) updates[key] = !!req.body[key];
        });

        // Optional field updates
        const fields = ['app_name', 'app_slug', 'app_description', 'token_symbol', 'token_address',
                        'staking_address', 'claws_funded', 'tweet_id', 'poll_tweet_id',
                        'poll_results', 'poll_winner', 'poll_votes', 'token_utility', 'feedback_status'];
        fields.forEach(f => {
            if (req.body[f] !== undefined) updates[f] = req.body[f];
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        try {
            const { data, error } = await supabase
                .from('app_factory_pipelines')
                .update(updates)
                .eq('id', id)
                .select('*')
                .single();

            if (error) {
                console.error('Factory update error:', error);
                return res.status(500).json({ error: 'Failed to update pipeline' });
            }

            return res.status(200).json({ success: true, pipeline: data });
        } catch (err) {
            console.error('Factory PATCH error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
