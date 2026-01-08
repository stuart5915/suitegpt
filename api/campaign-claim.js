import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// API endpoint for users to claim campaign rewards
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { campaign_id, discord_id } = req.body;

        if (!campaign_id || !discord_id) {
            return res.status(400).json({ error: 'Missing campaign_id or discord_id' });
        }

        // Call the claim function
        const { data, error } = await supabase.rpc('claim_campaign_reward', {
            p_campaign_id: campaign_id,
            p_discord_id: discord_id
        });

        if (error) throw error;

        if (data.success) {
            console.log(`[Campaign Claim] ${discord_id} claimed ${data.amount} SUITE from campaign ${campaign_id}`);
            return res.status(200).json(data);
        } else {
            return res.status(400).json(data);
        }

    } catch (error) {
        console.error('[Campaign Claim] Error:', error);
        return res.status(500).json({ error: 'Failed to claim reward' });
    }
}
