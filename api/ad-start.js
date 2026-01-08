import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Minimum time user must wait (in seconds)
const MIN_WATCH_TIME = 25; // 25 seconds minimum (allowing 5s buffer from 30s timer)

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { discord_id } = req.body;

        if (!discord_id) {
            return res.status(400).json({ error: 'Missing discord_id' });
        }

        // Generate a secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // Store token in ad_events with 'started' status
        const { data, error } = await supabase
            .from('ad_events')
            .insert({
                discord_id,
                event_type: 'started',
                adsterra_subid: token,
                suite_amount: 2,
                credited: false
            })
            .select()
            .single();

        if (error) {
            console.error('[Ad Start] Error creating token:', error);
            return res.status(500).json({ error: 'Failed to create session' });
        }

        console.log(`[Ad Start] Token created for ${discord_id}: ${token.substring(0, 8)}...`);

        return res.status(200).json({
            success: true,
            token,
            min_wait_seconds: MIN_WATCH_TIME
        });

    } catch (error) {
        console.error('[Ad Start] Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
