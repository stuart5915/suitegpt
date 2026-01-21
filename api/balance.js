import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://getsuite.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { discord_id } = req.query;

    if (!discord_id) {
        return res.status(400).json({ error: 'Missing discord_id' });
    }

    try {
        // Get user's current balance
        const { data: user, error: userError } = await supabase
            .from('user_credits')
            .select('suite_balance, free_actions_used, total_ads_watched')
            .eq('discord_id', discord_id)
            .single();

        if (userError && userError.code !== 'PGRST116') {
            throw userError;
        }

        // Get recent ad events
        const { data: recentAds, error: adsError } = await supabase
            .from('ad_events')
            .select('*')
            .eq('discord_id', discord_id)
            .order('created_at', { ascending: false })
            .limit(5);

        const suiteBalance = user?.suite_balance || 0;
        const freeActionsRemaining = 20 - (user?.free_actions_used || 0);
        const totalAdsWatched = user?.total_ads_watched || 0;

        return res.status(200).json({
            success: true,
            discord_id,
            suite_balance: suiteBalance,
            free_actions_remaining: freeActionsRemaining,
            total_ads_watched: totalAdsWatched,
            dollar_value: (suiteBalance * 0.001).toFixed(2),
            recent_ads: recentAds || []
        });

    } catch (error) {
        console.error('[Balance API] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch balance' });
    }
}
