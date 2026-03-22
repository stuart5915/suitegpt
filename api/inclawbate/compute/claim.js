// Inclawbate Compute — Claim CLAWS Rewards
// Server signs an ECDSA authorization for the node operator to claim on-chain.
// Same pattern as PokerAI rewards: server signs, user submits tx, pays own gas.

import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// CLAWS per compute unit (adjustable — start generous, tune over time)
const CLAWS_PER_UNIT = BigInt(process.env.CLAWS_PER_COMPUTE_UNIT || '1000000000000000000'); // 1 CLAWS (1e18) per unit default

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const OPERATOR_KEY = process.env.OPERATOR_PRIVATE_KEY;
    const COMPUTE_REWARDS_ADDRESS = process.env.COMPUTE_REWARDS_ADDRESS;

    if (!OPERATOR_KEY || !COMPUTE_REWARDS_ADDRESS) {
        return res.status(500).json({ error: 'Compute rewards not configured' });
    }

    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    try {
        // Get node info
        const { data: node, error: fetchErr } = await supabase
            .from('compute_nodes')
            .select('*')
            .eq('wallet', wallet.toLowerCase())
            .single();

        if (fetchErr || !node) {
            return res.status(404).json({ error: 'Node not found' });
        }

        const unclaimedUnits = node.unclaimed_units || 0;
        if (unclaimedUnits <= 0) {
            return res.status(400).json({ error: 'No unclaimed compute units' });
        }

        // Calculate CLAWS amount
        const clawsAmount = BigInt(unclaimedUnits) * CLAWS_PER_UNIT;
        const nonce = node.claim_nonce || 0;

        // Sign the claim authorization (same pattern as PokerAIRewards)
        const operatorWallet = new ethers.Wallet(OPERATOR_KEY);
        const messageHash = ethers.solidityPackedKeccak256(
            ['address', 'uint256', 'uint256', 'address'],
            [wallet, clawsAmount, nonce, COMPUTE_REWARDS_ADDRESS]
        );
        const signature = await operatorWallet.signMessage(ethers.getBytes(messageHash));

        // Reset unclaimed units and bump nonce
        const { error: updateErr } = await supabase
            .from('compute_nodes')
            .update({
                unclaimed_units: 0,
                claim_nonce: nonce + 1,
                last_claim: new Date().toISOString()
            })
            .eq('wallet', wallet.toLowerCase());

        if (updateErr) throw updateErr;

        return res.status(200).json({
            ok: true,
            claim: {
                amount: clawsAmount.toString(),
                amount_display: ethers.formatEther(clawsAmount) + ' CLAWS',
                nonce,
                signature,
                contract: COMPUTE_REWARDS_ADDRESS,
                compute_units_claimed: unclaimedUnits
            },
            message: 'Call claim(' + clawsAmount.toString() + ', ' + nonce + ', "' + signature + '") on the ComputeRewards contract'
        });

    } catch (error) {
        console.error('Claim error:', error);
        return res.status(500).json({ error: 'Claim failed: ' + error.message });
    }
}
