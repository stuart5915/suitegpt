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

        // Auto-deploy staking pool if requested and token deployed
        if (deploy_staking !== false && result.token_address) {
            try {
                const stakingResult = await deployStakingPool({
                    token_address: result.token_address,
                    creator_wallet
                });
                result.staking_address = stakingResult.pool_address;
                result.staking_tx = stakingResult.tx_hash;

                // Update the inclawbator_projects row with staking address
                try {
                    await supabase
                        .from('inclawbator_projects')
                        .update({ staking_address: stakingResult.pool_address })
                        .eq('token_address', result.token_address.toLowerCase());
                } catch (e) {
                    console.error('Staking address update failed (non-fatal):', e.message);
                }
            } catch (stakingErr) {
                console.error('Auto-staking deploy failed (non-fatal):', stakingErr.message);
                result.staking_error = stakingErr.message;
            }
        }

        // Also update the apps table if MemeClaw published a site for this token
        if (result.token_address) {
            try {
                await supabase
                    .from('apps')
                    .update({
                        token_address: result.token_address.toLowerCase(),
                        token_symbol: symbol.toUpperCase(),
                        ...(result.staking_address ? { staking_address: result.staking_address } : {})
                    })
                    .ilike('name', `%${name}%`)
                    .is('token_address', null);
            } catch (e) {
                console.error('Apps table update failed (non-fatal):', e.message);
            }
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('launch-token error:', err);
        return res.status(500).json({ error: err.message });
    }
}
