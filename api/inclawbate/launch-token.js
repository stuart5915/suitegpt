// Inclawbate — Direct Token Launch API
// POST { name, symbol, creator_wallet, description, image_url, website_url, reward_recipients, reward_bps }
// Bypasses agent-chat AI — calls launchToken directly with structured params

import { launchToken, deployStakingPool } from './onchain-actions.js';

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
            } catch (stakingErr) {
                console.error('Auto-staking deploy failed (non-fatal):', stakingErr.message);
                result.staking_error = stakingErr.message;
            }
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('launch-token error:', err);
        return res.status(500).json({ error: err.message });
    }
}
