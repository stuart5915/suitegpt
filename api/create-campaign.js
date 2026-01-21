import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

// API endpoint to create a new campaign
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', 'https://getsuite.app');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const {
            app_id,
            developer_discord_id,
            suite_per_claim,
            total_budget,
            max_claims,
            require_time,
            min_time_seconds,
            require_actions,
            min_actions
        } = req.body;

        if (!app_id || !developer_discord_id || !suite_per_claim || !total_budget) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify the app belongs to this developer
        const { data: app, error: appError } = await supabase
            .from('apps')
            .select('id, creator_discord_id')
            .eq('id', app_id)
            .single();

        if (appError || !app) {
            return res.status(400).json({ error: 'App not found' });
        }

        if (app.creator_discord_id !== developer_discord_id) {
            return res.status(403).json({ error: 'You do not own this app' });
        }

        // Check developer has enough SUITE balance
        const { data: userCredits, error: creditsError } = await supabase
            .from('user_credits')
            .select('suite_balance')
            .eq('discord_id', developer_discord_id)
            .single();

        const currentBalance = userCredits?.suite_balance || 0;
        if (currentBalance < total_budget) {
            return res.status(400).json({
                error: `Insufficient SUITE. You have ${currentBalance} but need ${total_budget}`
            });
        }

        // Deduct SUITE from developer balance
        const { error: deductError } = await supabase
            .from('user_credits')
            .update({ suite_balance: currentBalance - total_budget })
            .eq('discord_id', developer_discord_id);

        if (deductError) {
            return res.status(500).json({ error: 'Failed to deduct SUITE' });
        }

        // Create the campaign
        const { data: campaign, error: campaignError } = await supabase
            .from('app_campaigns')
            .insert({
                app_id,
                developer_discord_id,
                suite_per_claim,
                total_budget,
                remaining_budget: total_budget,
                max_claims,
                require_time: require_time || false,
                min_time_seconds: min_time_seconds || 0,
                require_actions: require_actions || false,
                min_actions: min_actions || 0,
                status: 'active'
            })
            .select()
            .single();

        if (campaignError) {
            // Refund the SUITE if campaign creation fails
            await supabase
                .from('user_credits')
                .update({ suite_balance: currentBalance })
                .eq('discord_id', developer_discord_id);

            return res.status(500).json({ error: 'Failed to create campaign' });
        }

        console.log(`[Create Campaign] ${developer_discord_id} created campaign for app ${app_id} with ${total_budget} SUITE budget`);

        return res.status(200).json({
            success: true,
            campaign_id: campaign.id,
            message: 'Campaign created successfully!'
        });

    } catch (error) {
        console.error('[Create Campaign] Error:', error);
        return res.status(500).json({ error: 'Failed to create campaign' });
    }
}
