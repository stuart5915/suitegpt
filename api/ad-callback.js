import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Minimum time user must wait (in seconds)
const MIN_WATCH_TIME = 25;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Use POST.' });
    }

    try {
        const { discord_id, token } = req.body;

        if (!discord_id || !token) {
            return res.status(400).json({ error: 'Missing discord_id or token' });
        }

        // Find the token in ad_events
        const { data: tokenData, error: tokenError } = await supabase
            .from('ad_events')
            .select('*')
            .eq('adsterra_subid', token)
            .eq('discord_id', discord_id)
            .eq('event_type', 'started')
            .single();

        if (tokenError || !tokenData) {
            console.log(`[Ad Callback] Invalid token for ${discord_id}`);
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        // Check if already credited
        if (tokenData.credited) {
            return res.status(400).json({ error: 'Token already used' });
        }

        // Check minimum time elapsed
        const createdAt = new Date(tokenData.created_at);
        const now = new Date();
        const secondsElapsed = (now - createdAt) / 1000;

        if (secondsElapsed < MIN_WATCH_TIME) {
            console.log(`[Ad Callback] Too fast: ${secondsElapsed}s < ${MIN_WATCH_TIME}s`);
            return res.status(400).json({
                error: 'Ad not watched long enough',
                waited: Math.floor(secondsElapsed),
                required: MIN_WATCH_TIME
            });
        }

        // All checks passed - credit the user
        const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        // Call the credit function
        const { data: creditResult, error: creditError } = await supabase.rpc('credit_user_from_ad', {
            p_discord_id: discord_id,
            p_subid: token,
            p_ip: ipAddress,
            p_user_agent: userAgent
        });

        if (creditError) {
            console.error('[Ad Callback] Credit error:', creditError);
            return res.status(500).json({ error: 'Failed to credit user' });
        }

        // Mark the original token as used (in case RPC didn't update it)
        await supabase
            .from('ad_events')
            .update({ credited: true, event_type: 'credited' })
            .eq('adsterra_subid', token);

        console.log(`[Ad Callback] Success for ${discord_id}: +2 SUITE`);

        return res.status(200).json({
            success: true,
            message: 'Credit applied',
            amount: 2,
            new_balance: creditResult?.new_balance || null
        });

    } catch (error) {
        console.error('[Ad Callback] Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
