import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// API endpoint for apps to report user progress
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://getsuite.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const {
            campaign_id,
            discord_id,
            time_delta = 0,           // Seconds since last ping
            action_hash = null        // Hash of unique action (optional)
        } = req.body;

        if (!campaign_id || !discord_id) {
            return res.status(400).json({ error: 'Missing campaign_id or discord_id' });
        }

        // Get or create progress record
        const { data: existing } = await supabase
            .from('campaign_progress')
            .select('*')
            .eq('campaign_id', campaign_id)
            .eq('discord_id', discord_id)
            .single();

        if (existing) {
            // Update existing progress
            const updates = {
                time_spent_seconds: existing.time_spent_seconds + time_delta,
                last_ping: new Date().toISOString()
            };

            // Add unique action if not already tracked
            if (action_hash && !existing.action_hashes?.includes(action_hash)) {
                updates.action_hashes = [...(existing.action_hashes || []), action_hash];
                updates.unique_actions = (existing.unique_actions || 0) + 1;
            }

            const { data, error } = await supabase
                .from('campaign_progress')
                .update(updates)
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json({
                success: true,
                progress: {
                    time_spent_seconds: data.time_spent_seconds,
                    unique_actions: data.unique_actions,
                    claimed: data.claimed
                }
            });
        } else {
            // Create new progress record
            const { data, error } = await supabase
                .from('campaign_progress')
                .insert({
                    campaign_id,
                    discord_id,
                    time_spent_seconds: time_delta,
                    unique_actions: action_hash ? 1 : 0,
                    action_hashes: action_hash ? [action_hash] : []
                })
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json({
                success: true,
                progress: {
                    time_spent_seconds: data.time_spent_seconds,
                    unique_actions: data.unique_actions,
                    claimed: false
                }
            });
        }

    } catch (error) {
        console.error('[Campaign Progress] Error:', error);
        return res.status(500).json({ error: 'Failed to update progress' });
    }
}
