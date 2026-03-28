// Inclawbate — Direct Token Launch API
// POST { name, symbol, creator_wallet, description, image_url, website_url, reward_recipients, reward_bps }
// Bypasses agent-chat AI — calls launchToken directly with structured params

export const config = { maxDuration: 120 };

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

    const { name, symbol, creator_wallet, description, image_url, website_url, reward_recipients, reward_bps, deploy_staking, airdrop_address, airdrop_pct } = req.body || {};

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
            reward_bps,
            airdrop_address,
            airdrop_pct: airdrop_pct ? parseInt(airdrop_pct) : 0
        });

        // Return token address IMMEDIATELY
        // Staking pool is deployed by Railway (meme-launcher) after this returns
        res.status(200).json(result);

        // Link app to project
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
