import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// Adsterra IP ranges for verification (add more as needed)
const ADSTERRA_IPS = [
    // Adsterra doesn't publish exact IPs, so we'll use a secret token instead
];

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow GET and POST (Adsterra can use either)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get parameters from query or body
        const params = req.method === 'GET' ? req.query : req.body;

        // subid contains Discord user ID (passed from earn page)
        const { subid, subid1, subid2, payout, status } = params;

        // Discord ID is passed as subid
        const discordId = subid || subid1;

        if (!discordId) {
            console.log('[Ad Callback] Missing discord ID in subid');
            return res.status(400).json({ error: 'Missing subid (discord_id)' });
        }

        // Optional: Verify secret token if configured
        const secretToken = params.token || req.headers['x-adsterra-token'];
        if (process.env.ADSTERRA_SECRET && secretToken !== process.env.ADSTERRA_SECRET) {
            console.log('[Ad Callback] Invalid secret token');
            return res.status(403).json({ error: 'Invalid token' });
        }

        // Generate unique subid for this callback to prevent duplicates
        const uniqueSubid = `${discordId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Get request metadata
        const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';

        console.log(`[Ad Callback] Processing for discord_id: ${discordId}`);

        // Call the Supabase function to credit user
        const { data, error } = await supabase.rpc('credit_user_from_ad', {
            p_discord_id: discordId,
            p_subid: uniqueSubid,
            p_ip: ipAddress,
            p_user_agent: userAgent
        });

        if (error) {
            console.error('[Ad Callback] Supabase error:', error);

            // Log failed event directly
            await supabase.from('ad_events').insert({
                discord_id: discordId,
                event_type: 'failed',
                adsterra_subid: uniqueSubid,
                ip_address: ipAddress,
                user_agent: userAgent,
                error_message: error.message
            });

            return res.status(500).json({ error: 'Failed to credit user', details: error.message });
        }

        console.log(`[Ad Callback] Success:`, data);

        // Return success
        return res.status(200).json({
            success: true,
            message: 'Credit applied',
            ...data
        });

    } catch (error) {
        console.error('[Ad Callback] Unexpected error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
