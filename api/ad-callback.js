import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const ADSTERRA_API_TOKEN = process.env.ADSTERRA_API_TOKEN;
const MIN_WATCH_TIME = 25; // seconds

// Get today's revenue from Adsterra
async function getAdsterraRevenue() {
    if (!ADSTERRA_API_TOKEN) return null;

    try {
        const today = new Date().toISOString().split('T')[0];
        const url = `https://api.adsterratools.com/publisher/${ADSTERRA_API_TOKEN}/stats.json?start_date=${today}&finish_date=${today}`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const data = await response.json();
        let totalRevenue = 0;
        if (data.items && Array.isArray(data.items)) {
            for (const item of data.items) {
                totalRevenue += parseFloat(item.revenue || 0);
            }
        }
        return totalRevenue;
    } catch (error) {
        console.error('[Adsterra] Error:', error);
        return null;
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://getsuite.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

    try {
        const { discord_id, session_id } = req.body;
        if (!discord_id || !session_id) {
            return res.status(400).json({ error: 'Missing discord_id or session_id' });
        }

        // Get the session
        const { data: session, error: sessionError } = await supabase
            .from('ad_events')
            .select('*')
            .eq('id', session_id)
            .eq('discord_id', discord_id)
            .eq('event_type', 'started')
            .single();

        if (sessionError || !session) {
            return res.status(400).json({ error: 'Invalid or expired session' });
        }

        if (session.credited) {
            return res.status(400).json({ error: 'Session already used' });
        }

        // Check minimum time
        const createdAt = new Date(session.created_at);
        const secondsElapsed = (Date.now() - createdAt.getTime()) / 1000;

        if (secondsElapsed < MIN_WATCH_TIME) {
            return res.status(400).json({
                error: 'Please wait for the full ad',
                waited: Math.floor(secondsElapsed),
                required: MIN_WATCH_TIME
            });
        }

        // Check if Adsterra revenue increased
        let revenueVerified = false;
        const currentRevenue = await getAdsterraRevenue();

        if (currentRevenue !== null && session.error_message?.startsWith('revenue_snapshot:')) {
            const snapshotRevenue = parseFloat(session.error_message.split(':')[1]);
            revenueVerified = currentRevenue > snapshotRevenue;
            console.log(`[Ad Callback] Revenue check: ${snapshotRevenue} → ${currentRevenue} (verified: ${revenueVerified})`);
        }

        // IMPORTANT: Credit user if they waited the full time
        // Revenue verification is a bonus check, not a requirement
        // This prevents false rejections due to Adsterra API delays
        // If API token not configured, revenueVerified stays false but we still credit

        // Credit the user
        const { data: creditResult, error: creditError } = await supabase.rpc('credit_user_from_ad', {
            p_discord_id: discord_id,
            p_subid: session.adsterra_subid,
            p_ip: req.headers['x-forwarded-for'] || 'unknown',
            p_user_agent: req.headers['user-agent'] || 'unknown'
        });

        if (creditError) throw creditError;

        // Mark session as credited
        await supabase
            .from('ad_events')
            .update({
                credited: true,
                event_type: 'credited',
                error_message: `revenue_verified:${revenueVerified}`
            })
            .eq('id', session_id);

        console.log(`[Ad Callback] Success for ${discord_id}: +2 SUITE (revenue_verified: ${revenueVerified})`);

        return res.status(200).json({
            success: true,
            amount: 2,
            new_balance: creditResult?.new_balance,
            revenue_verified: revenueVerified
        });

    } catch (error) {
        console.error('[Ad Callback] Error:', error);
        return res.status(500).json({ error: 'Failed to process request' });
    }
}
