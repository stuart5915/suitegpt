// Inclawbate — UBI Staking Skill Document
// GET /api/inclawbate/skill/staking — machine-readable spec for AI agents

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    return res.status(200).json({
        schema: 'inclawbate/skill/v1',
        name: 'UBI Staking',
        description: 'Full access to the Inclawbate UBI staking system on Base. Read treasury stats, wallet positions, and leaderboards. Stake and unstake INCLAWNCH tokens. Toggle auto-compounding. Powered by daily UBI distributions to all stakers.',
        url: 'https://inclawbate.com/ubi',
        category: 'defi-staking',
        status: 'live',
        token: {
            name: 'INCLAWNCH',
            symbol: 'INCLAWNCH',
            chain: 'Base',
            contract: '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            basescan: 'https://basescan.org/token/0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be',
            staking_contract: '0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6',
            deposit_wallet: '0xa4d6f012003fe6ad2774a874c8c98ee69d17f286'
        },
        capabilities: [
            {
                name: 'get_treasury_stats',
                description: 'Fetch UBI treasury overview: total stakers, TVL, APY estimate, distribution rates, total distributed, and top 20 stakers leaderboard. No parameters needed.',
                method: 'GET',
                endpoint: 'https://inclawbate.com/api/inclawbate/staking',
                parameters: {},
                cache: '60 seconds',
                example: 'GET /api/inclawbate/staking'
            },
            {
                name: 'get_wallet_position',
                description: 'Fetch a specific wallet\'s staking position: total staked, share percentage, estimated daily/weekly rewards, auto-stake preference, total rewards received, and active stake history.',
                method: 'GET',
                endpoint: 'https://inclawbate.com/api/inclawbate/staking',
                parameters: {
                    wallet: { type: 'string', required: true, description: 'EVM wallet address (e.g. 0x...)' }
                },
                cache: '60 seconds',
                example: 'GET /api/inclawbate/staking?wallet=0x91b5c0d07859cfeafeb67d9694121cd741f049bd'
            },
            {
                name: 'stake_inclawnch',
                description: 'Stake INCLAWNCH tokens into the UBI pool. First transfer INCLAWNCH to the deposit wallet on Base via ERC20 transfer, then call this endpoint with the transaction hash. The API verifies the on-chain transfer and records the stake. Stakers earn daily UBI distributions proportional to their stake.',
                method: 'POST',
                endpoint: 'https://inclawbate.com/api/inclawbate/ubi',
                parameters: {
                    action: { type: 'string', required: true, value: 'fund', description: 'Must be "fund"' },
                    tx_hash: { type: 'string', required: true, description: 'Transaction hash of the ERC20 transfer to the deposit wallet (0x + 64 hex chars)' },
                    wallet_address: { type: 'string', required: true, description: 'Your wallet address (must match the tx sender)' }
                },
                workflow: [
                    '1. Call transfer(deposit_wallet, amount) on the INCLAWNCH contract (0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be) on Base',
                    '2. Wait for transaction confirmation',
                    '3. POST to this endpoint with the tx_hash and your wallet_address'
                ],
                example: 'POST /api/inclawbate/ubi { "action": "fund", "tx_hash": "0x...", "wallet_address": "0x..." }'
            },
            {
                name: 'unstake_inclawnch',
                description: 'Unstake all INCLAWNCH tokens. No lock period — request anytime. Tokens are returned to your wallet within 24 hours (instantly if the unstake wallet has sufficient balance).',
                method: 'POST',
                endpoint: 'https://inclawbate.com/api/inclawbate/ubi',
                parameters: {
                    action: { type: 'string', required: true, value: 'unstake', description: 'Must be "unstake"' },
                    wallet_address: { type: 'string', required: true, description: 'Your wallet address' },
                    token: { type: 'string', required: true, description: 'Token to unstake: "clawnch"' }
                },
                example: 'POST /api/inclawbate/ubi { "action": "unstake", "wallet_address": "0x...", "token": "clawnch" }'
            },
            {
                name: 'toggle_auto_stake',
                description: 'Toggle auto-compounding of UBI rewards. When enabled, daily reward distributions are automatically re-staked instead of sent to your wallet — compounding your position over time.',
                method: 'POST',
                endpoint: 'https://inclawbate.com/api/inclawbate/ubi',
                parameters: {
                    action: { type: 'string', required: true, value: 'toggle-auto-stake', description: 'Must be "toggle-auto-stake"' },
                    wallet_address: { type: 'string', required: true, description: 'Your wallet address' }
                },
                example: 'POST /api/inclawbate/ubi { "action": "toggle-auto-stake", "wallet_address": "0x..." }'
            }
        ],
        response_shape: {
            treasury: 'total_stakers, total_staked, tvl_usd, weekly_distribution_rate, daily_distribution_rate, total_distributed, total_distributed_usd, distribution_count, estimated_apy, wallet_cap_pct, last_distribution_at',
            token: 'name, symbol, address, chain, price_usd, staking_contract, deposit_wallet',
            top_stakers: '[{ x_handle, x_name, total_staked, staked_usd, stake_count, staking_since }]',
            wallet_position: '(only when ?wallet= provided) total_staked, staked_usd, share_pct, estimated_daily_reward, estimated_weekly_reward, auto_stake_enabled, total_rewards_received, give_back_target, active_stakes[], pending_unstakes[]',
            updated_at: 'ISO 8601 timestamp'
        },
        staking_mechanics: {
            how_to_stake: 'Transfer INCLAWNCH to the deposit_wallet via ERC20 transfer on Base, then call POST /api/inclawbate/ubi with action "fund" and the tx_hash',
            distributions: 'Daily at 6am EST. Proportional to staked amount weighted by staker-days.',
            unstaking: 'No lock period. Request unstake anytime. Tokens returned within 24 hours.',
            auto_stake: 'Users can enable auto-restaking of rewards for compounding.',
            give_back: 'Stakers can redirect a percentage of rewards to philanthropy orgs via Kingdom.',
            wallet_cap: 'No single wallet can receive more than wallet_cap_pct of daily distribution.'
        },
        use_cases: [
            'Stake INCLAWNCH tokens into the UBI pool on behalf of a user',
            'Unstake tokens and return them to the user\'s wallet',
            'Enable auto-compounding to grow staking position over time',
            'Report a user\'s staking position and estimated rewards',
            'Show UBI treasury health — TVL, APY, staker count',
            'Display top stakers leaderboard',
            'Calculate projected returns for a given stake amount',
            'Monitor distribution frequency and total UBI distributed',
            'Compare staking APY across DeFi protocols'
        ],
        data_sources: [
            'Supabase (staking positions, treasury stats, distribution history)',
            'DexScreener (INCLAWNCH price for USD calculations)'
        ],
        related_skills: [
            {
                name: 'INCLAWNCH Analytics',
                endpoint: 'https://inclawbate.com/api/inclawbate/skill/analytics',
                description: 'Token price, volume, liquidity, and broader ecosystem metrics'
            }
        ]
    });
}
