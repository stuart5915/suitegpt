// Inclawbate — Direct Token Launch API
// POST { name, symbol, creator_wallet, description, image_url, website_url, reward_recipients, reward_bps }
// Bypasses agent-chat AI — calls launchToken directly with structured params

import { launchToken, deployStakingPool } from './onchain-actions.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const { name, symbol, creator_wallet, description, image_url, website_url, reward_recipients, reward_bps, deploy_staking } = req.body || {};

    if (!name) return res.status(400).json({ error: 'name is required' });
    if (!symbol) return res.status(400).json({ error: 'symbol is required' });
    if (!creator_wallet) return res.status(400).json({ error: 'creator_wallet is required' });

    try {
        const result = await launchToken({
            name,
            symbol,
            creator_wallet,
            description: description || '',
            image_url: image_url || '',
            website_url: website_url || '',
            reward_recipients,
            reward_bps
        });

        // Return token address IMMEDIATELY — don't wait for staking/linking
        // This prevents Vercel 60s timeout
        res.status(200).json(result);

        // Background: deploy staking pool + link app (after response sent)
        if (deploy_staking !== false && result.token_address) {
            try {
                const stakingResult = await deployStakingPool({
                    token_address: result.token_address,
                    creator_wallet
                });
                console.log('Staking pool deployed:', stakingResult.pool_address);

                await supabase
                    .from('inclawbator_projects')
                    .update({ staking_address: stakingResult.pool_address })
                    .eq('token_address', result.token_address.toLowerCase());
            } catch (stakingErr) {
                console.error('Auto-staking deploy failed (non-fatal):', stakingErr.message);
            }
        }

        // Background: link app to project
        if (result.token_address) {
            try {
                const { data: app } = await supabase
                    .from('apps')
                    .select('id')
                    .ilike('name', `%${name}%`)
                    .limit(1)
                    .single();
                if (app) {
                    await supabase
                        .from('inclawbator_projects')
                        .update({ website_url: app.id })
                        .eq('token_address', result.token_address.toLowerCase());
                }
            } catch (e) {
                console.error('App-project link failed (non-fatal):', e.message);
            }
        }
    } catch (err) {
        console.error('launch-token error:', err);
        if (!res.headersSent) return res.status(500).json({ error: err.message });
    }
}
