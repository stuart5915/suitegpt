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
        description: 'Read-only access to the Inclawbate UBI staking system on Base. Get treasury stats (TVL, APY, distribution rates), top stakers leaderboard, and any wallet\'s staking position including rewards history. Powered by INCLAWNCH token staking with daily UBI distributions.',
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
