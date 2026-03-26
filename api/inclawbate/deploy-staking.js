// Inclawbate — Deploy Staking Pool API
// POST { token_address, creator_wallet }
// Deploys a staking pool (stake token, earn CLAWS) and registers it

import { deployStakingPool } from './onchain-actions.js';
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

    const { token_address, creator_wallet } = req.body || {};
    if (!token_address) return res.status(400).json({ error: 'token_address is required' });
    if (!creator_wallet) return res.status(400).json({ error: 'creator_wallet is required' });

    try {
        const result = await deployStakingPool({ token_address, creator_wallet });

        // Update inclawbator_projects with staking address
        if (result.pool_address) {
            await supabase
                .from('inclawbator_projects')
                .update({ staking_address: result.pool_address })
                .eq('token_address', token_address.toLowerCase());
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('deploy-staking error:', err);
        return res.status(500).json({ error: err.message });
    }
}
