// AppDB — persistent key-value storage for user-built apps
// Single endpoint: POST /api/appdb { action, app_id, user_scope, key, value }

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_VALUE_SIZE = 102400; // 100KB
const MAX_KEYS_PER_SCOPE = 1000;

function cors(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { action, app_id, user_scope, key, value } = req.body || {};

    if (!app_id) return res.status(400).json({ error: 'app_id required' });
    if (!action) return res.status(400).json({ error: 'action required' });

    // Validate app exists
    const { data: app, error: appErr } = await supabase
        .from('user_apps')
        .select('id')
        .eq('id', app_id)
        .single();

    if (appErr || !app) return res.status(404).json({ error: 'App not found' });

    const scope = user_scope || '_global';

    try {
        if (action === 'get') {
            if (!key) return res.status(400).json({ error: 'key required' });
            const { data, error } = await supabase
                .from('app_data')
                .select('value')
                .eq('app_id', app_id)
                .eq('user_scope', scope)
                .eq('key', key)
                .maybeSingle();

            if (error) throw error;
            return res.json({ value: data ? data.value : null });

        } else if (action === 'set') {
            if (!key) return res.status(400).json({ error: 'key required' });
            const encoded = JSON.stringify(value);
            if (encoded && encoded.length > MAX_VALUE_SIZE) {
                return res.status(413).json({ error: 'Value exceeds 100KB limit' });
            }

            // Check key count limit
            const { count } = await supabase
                .from('app_data')
                .select('id', { count: 'exact', head: true })
                .eq('app_id', app_id)
                .eq('user_scope', scope);

            if (count >= MAX_KEYS_PER_SCOPE) {
                // Allow if key already exists (update), block if new key
                const { data: existing } = await supabase
                    .from('app_data')
                    .select('id')
                    .eq('app_id', app_id)
                    .eq('user_scope', scope)
                    .eq('key', key)
                    .maybeSingle();

                if (!existing) {
                    return res.status(429).json({ error: 'Key limit reached (1000 per scope)' });
                }
            }

            const { error } = await supabase
                .from('app_data')
                .upsert({
                    app_id,
                    user_scope: scope,
                    key,
                    value,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'app_id,user_scope,key' });

            if (error) throw error;
            return res.json({ ok: true });

        } else if (action === 'delete') {
            if (!key) return res.status(400).json({ error: 'key required' });
            const { error } = await supabase
                .from('app_data')
                .delete()
                .eq('app_id', app_id)
                .eq('user_scope', scope)
                .eq('key', key);

            if (error) throw error;
            return res.json({ ok: true });

        } else if (action === 'list') {
            const { data, error } = await supabase
                .from('app_data')
                .select('key, value')
                .eq('app_id', app_id)
                .eq('user_scope', scope)
                .order('key')
                .limit(MAX_KEYS_PER_SCOPE);

            if (error) throw error;
            return res.json({ entries: data || [] });

        } else {
            return res.status(400).json({ error: 'Invalid action. Use: get, set, delete, list' });
        }
    } catch (err) {
        console.error('AppDB error:', err);
        return res.status(500).json({ error: 'Database error' });
    }
}
