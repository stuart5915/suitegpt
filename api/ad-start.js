import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const ADSTERRA_API_TOKEN = process.env.ADSTERRA_API_TOKEN;

// Get today's revenue from Adsterra
async function getAdsterraRevenue() {
    if (!ADSTERRA_API_TOKEN) {
        console.log('[Adsterra] No API token configured');
        return null;
    }

    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const url = `https://api.adsterratools.com/publisher/${ADSTERRA_API_TOKEN}/stats.json?start_date=${today}&finish_date=${today}`;

        const response = await fetch(url);

        if (!response.ok) {
            console.error('[Adsterra] API error:', response.status);
            return null;
        }

        const data = await response.json();

        // Sum up revenue from all items
        let totalRevenue = 0;
        if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
                totalRevenue += parseFloat(item.revenue || 0);
            }
        }

        console.log(`[Adsterra] Today's revenue: $${totalRevenue.toFixed(4)}`);
        return totalRevenue;

    } catch (error) {
        console.error('[Adsterra] Error fetching stats:', error);
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { discord_id } = req.body;
        if (!discord_id) return res.status(400).json({ error: 'Missing discord_id' });

        // Get current Adsterra revenue
        const currentRevenue = await getAdsterraRevenue();

        // Store in ad_events with revenue snapshot
        const { data, error } = await supabase
            .from('ad_events')
            .insert({
                discord_id,
                event_type: 'started',
                adsterra_subid: `${discord_id}-${Date.now()}`,
                suite_amount: 2,
                credited: false,
                error_message: currentRevenue !== null ? `revenue_snapshot:${currentRevenue}` : 'no_api_token'
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(200).json({
            success: true,
            session_id: data.id,
            revenue_snapshot: currentRevenue,
            min_wait_seconds: 30
        });

    } catch (error) {
        console.error('[Ad Start] Error:', error);
        return res.status(500).json({ error: 'Failed to start session' });
    }
}
