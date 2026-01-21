import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// API endpoint to get active campaigns (for earn page)
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://getsuite.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const discord_id = req.query.discord_id;

        // Get active campaigns with app info
        const { data: campaigns, error } = await supabase
            .from('app_campaigns')
            .select(`
                id,
                suite_per_claim,
                require_time,
                min_time_seconds,
                require_actions,
                min_actions,
                remaining_budget,
                apps (
                    id,
                    name,
                    description,
                    icon_url
                )
            `)
            .eq('status', 'active')
            .gt('remaining_budget', 0)
            .order('suite_per_claim', { ascending: false });

        if (error) throw error;

        // If user provided, get their progress
        let userProgress = {};
        if (discord_id) {
            const { data: progress } = await supabase
                .from('campaign_progress')
                .select('campaign_id, time_spent_seconds, unique_actions, claimed')
                .eq('discord_id', discord_id);

            if (progress) {
                progress.forEach(p => {
                    userProgress[p.campaign_id] = p;
                });
            }
        }

        // Format response
        const result = campaigns.map(c => ({
            id: c.id,
            app: c.apps,
            reward: c.suite_per_claim,
            requirements: {
                time: c.require_time ? c.min_time_seconds : null,
                actions: c.require_actions ? c.min_actions : null
            },
            userProgress: userProgress[c.id] || null
        }));

        return res.status(200).json({ campaigns: result });

    } catch (error) {
        console.error('[Campaigns List] Error:', error);
        return res.status(500).json({ error: 'Failed to load campaigns' });
    }
}
