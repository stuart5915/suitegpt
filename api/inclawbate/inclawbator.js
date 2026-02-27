// Inclawbator — Project Registry API
// GET                              — list active projects (public, cached 60s)
// GET ?wallet=0x...                — projects by creator wallet
// POST action:"register"           — create project (JWT auth)
// POST action:"update-staking"     — set staking address after factory deploy (JWT auth, owner only)
// POST action:"approve"            — admin approves incubated project (admin_secret)
// POST action:"record-distribution"— log reward distribution (admin_secret)
// POST action:"update-fees"        — admin updates total_fees_claimed (admin_secret)
// POST action:"feed-agent"         — deposit INCLAWNCH to feed a project's AI agent

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

// ── Deposit verification (reused from credits.js) ──
const CLAWNCH_ADDRESS = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'.toLowerCase();
const PROTOCOL_WALLET = '0x91B5C0D07859CFeAfEB67d9694121CD741F049bd'.toLowerCase();
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TARGET_USD_PER_CREDIT = 0.005;

const BASE_RPCS = [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.drpc.org'
];

async function rpcCall(method, params) {
    for (let i = 0; i < BASE_RPCS.length; i++) {
        try {
            const resp = await fetch(BASE_RPCS[i], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
            });
            if (resp.status === 429) continue;
            const data = await resp.json();
            if (data.result !== undefined) return data.result;
        } catch (e) { /* try next */ }
    }
    return null;
}

async function fetchInclawnchPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWNCH_ADDRESS);
        const data = await resp.json();
        if (data.pairs && data.pairs.length > 0) {
            return parseFloat(data.pairs[0].priceUsd) || 0;
        }
    } catch (e) { /* price unavailable */ }
    return 0;
}

async function verifyDepositTx(txHash) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Transaction failed or not found' };
    }
    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === CLAWNCH_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No CLAWNCH transfer found in transaction' };
    }
    const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
    const amount = Number(BigInt(transferLog.data)) / 1e18;
    if (to !== PROTOCOL_WALLET) {
        return { valid: false, reason: 'Transfer was not sent to the protocol wallet' };
    }
    if (amount <= 0) {
        return { valid: false, reason: 'Transfer amount is zero' };
    }
    return { valid: true, amount };
}

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com'
];

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // ── GET — list projects ──
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

        // Strip secrets, but expose whether X is connected
        function sanitizeProjects(rows) {
            return (rows || []).map(p => {
                const { x_access_token, x_access_secret, ...safe } = p;
                safe.x_connected = !!(x_access_token && x_access_secret);
                return safe;
            });
        }

        const wallet = req.query.wallet;

        if (wallet) {
            const { data, error } = await supabase
                .from('inclawbator_projects')
                .select('*')
                .eq('creator_wallet', wallet.toLowerCase())
                .order('created_at', { ascending: false });

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ projects: sanitizeProjects(data) });
        }

        // Public: only active projects
        const { data, error } = await supabase
            .from('inclawbator_projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ projects: sanitizeProjects(data) });
    }

    // ── POST — actions ──
    if (req.method === 'POST') {
        const { action } = req.body;

        // ── Register new project ──
        if (action === 'register') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const {
                token_address, token_name, token_symbol, deploy_tx_hash,
                description, website_url, x_handle, telegram_url, logo_url,
                fee_split_bps, tier, creator_wallet, color, color_dim, glow,
                agent_enabled, agent_persona, agent_posts_per_day
            } = req.body;

            if (!token_name || !token_symbol || !creator_wallet) {
                return res.status(400).json({ error: 'token_name, token_symbol, and creator_wallet are required' });
            }

            const splitBps = parseInt(fee_split_bps) || 10000;
            if (splitBps < 2000 || splitBps > 10000) {
                return res.status(400).json({ error: 'fee_split_bps must be between 2000 (20%) and 10000 (100%)' });
            }

            const validTiers = ['incubated', 'permissionless', 'byt'];
            const projectTier = validTiers.includes(tier) ? tier : 'permissionless';
            const status = projectTier === 'permissionless' ? 'active' : 'pending';

            // Agent config
            const wantsAgent = agent_enabled === true;
            const postsPerDay = Math.min(12, Math.max(1, parseInt(agent_posts_per_day) || 4));

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .insert({
                    creator_wallet: creator_wallet.toLowerCase(),
                    creator_profile_id: user.sub || null,
                    token_address: token_address ? token_address.toLowerCase() : null,
                    token_name,
                    token_symbol: token_symbol.toUpperCase(),
                    deploy_tx_hash: deploy_tx_hash || null,
                    description: description || null,
                    website_url: website_url || null,
                    x_handle: x_handle || null,
                    telegram_url: telegram_url || null,
                    logo_url: logo_url || null,
                    fee_split_bps: splitBps,
                    tier: projectTier,
                    status,
                    color: color || undefined,
                    color_dim: color_dim || undefined,
                    glow: glow || undefined,
                    agent_enabled: wantsAgent,
                    agent_persona: wantsAgent ? (agent_persona || null) : null,
                    agent_posts_per_day: wantsAgent ? postsPerDay : 4,
                    agent_credits: wantsAgent ? 10 : 0,
                    agent_status: wantsAgent ? 'active' : 'dormant'
                })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(409).json({ error: 'Token address or deploy tx already registered' });
                }
                return res.status(500).json({ error: error.message });
            }

            return res.status(201).json({ project: data });
        }

        // ── Update staking address ──
        if (action === 'update-staking') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, staking_address, staking_deploy_tx } = req.body;
            if (!project_id || !staking_address) {
                return res.status(400).json({ error: 'project_id and staking_address required' });
            }

            // Verify ownership
            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            if (project.creator_profile_id !== user.sub) {
                return res.status(403).json({ error: 'Not the project owner' });
            }

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update({
                    staking_address: staking_address.toLowerCase(),
                    staking_deploy_tx: staking_deploy_tx || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ project: data });
        }

        // ── Admin: approve incubated project ──
        if (action === 'approve') {
            const { project_id, admin_secret } = req.body;
            const expectedSecret = process.env.INCLAWBATE_ADMIN_SECRET;
            if (!expectedSecret || admin_secret !== expectedSecret) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update({ status: 'active', updated_at: new Date().toISOString() })
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ project: data });
        }

        // ── Admin: record distribution ──
        if (action === 'record-distribution') {
            const { admin_secret, project_id, staking_address, amount, duration_seconds, tx_hash, distributed_by } = req.body;
            const expectedSecret = process.env.INCLAWBATE_ADMIN_SECRET;
            if (!expectedSecret || admin_secret !== expectedSecret) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!project_id || !staking_address || !amount || !duration_seconds || !tx_hash) {
                return res.status(400).json({ error: 'project_id, staking_address, amount, duration_seconds, tx_hash required' });
            }

            const { error: distErr } = await supabase
                .from('inclawbator_distributions')
                .insert({
                    project_id,
                    staking_address: staking_address.toLowerCase(),
                    amount,
                    duration_seconds,
                    tx_hash,
                    distributed_by: distributed_by || 'admin'
                });

            if (distErr) {
                if (distErr.code === '23505') return res.status(409).json({ error: 'Distribution tx already recorded' });
                return res.status(500).json({ error: distErr.message });
            }

            // Update project totals
            await supabase
                .from('inclawbator_projects')
                .update({
                    total_rewards_distributed: supabase.rpc ? amount : amount,
                    last_distribution_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', project_id);

            // Increment total_rewards_distributed properly
            const { data: proj } = await supabase
                .from('inclawbator_projects')
                .select('total_rewards_distributed')
                .eq('id', project_id)
                .single();

            if (proj) {
                await supabase
                    .from('inclawbator_projects')
                    .update({
                        total_rewards_distributed: parseFloat(proj.total_rewards_distributed || 0) + parseFloat(amount)
                    })
                    .eq('id', project_id);
            }

            return res.status(200).json({ ok: true });
        }

        // ── Admin: update fees claimed ──
        if (action === 'update-fees') {
            const { admin_secret, project_id, total_fees_claimed } = req.body;
            const expectedSecret = process.env.INCLAWBATE_ADMIN_SECRET;
            if (!expectedSecret || admin_secret !== expectedSecret) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!project_id || total_fees_claimed === undefined) {
                return res.status(400).json({ error: 'project_id and total_fees_claimed required' });
            }

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update({
                    total_fees_claimed: parseFloat(total_fees_claimed),
                    updated_at: new Date().toISOString()
                })
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ project: data });
        }

        // ── Feed agent — deposit INCLAWNCH to add credits ──
        if (action === 'feed-agent') {
            const { project_id, tx_hash } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id required' });
            if (!tx_hash || typeof tx_hash !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(tx_hash)) {
                return res.status(400).json({ error: 'Valid tx_hash required' });
            }

            // Check project exists and has agent enabled
            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('id, agent_enabled, agent_status, token_symbol')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            if (!project.agent_enabled) return res.status(400).json({ error: 'Agent not enabled for this project' });

            // Check for duplicate tx
            const { data: existing } = await supabase
                .from('inclawbator_agent_deposits')
                .select('id')
                .eq('tx_hash', tx_hash.toLowerCase())
                .single();

            if (existing) return res.status(409).json({ error: 'This transaction has already been credited' });

            // Verify on-chain
            const verification = await verifyDepositTx(tx_hash);
            if (!verification.valid) return res.status(400).json({ error: verification.reason });

            // Fetch live price
            const livePrice = await fetchInclawnchPrice();
            if (livePrice <= 0) {
                return res.status(503).json({ error: 'Unable to fetch INCLAWNCH price. Try again shortly.' });
            }

            const tokensPerCredit = TARGET_USD_PER_CREDIT / livePrice;
            const credits = Math.floor(verification.amount / tokensPerCredit);
            if (credits <= 0) {
                return res.status(400).json({ error: `Deposit too small. Min ~${Math.ceil(tokensPerCredit)} INCLAWNCH for 1 credit.` });
            }

            // Record deposit
            const { error: insertErr } = await supabase
                .from('inclawbator_agent_deposits')
                .insert({
                    project_id,
                    depositor_wallet: 'unknown', // no auth required to feed
                    tx_hash: tx_hash.toLowerCase(),
                    inclawnch_amount: verification.amount,
                    credits_granted: credits
                });

            if (insertErr) {
                if (insertErr.code === '23505') return res.status(409).json({ error: 'Transaction already credited' });
                return res.status(500).json({ error: 'Failed to record deposit' });
            }

            // Add credits atomically
            const { data: newBalance } = await supabase.rpc('add_agent_credits', {
                p_project_id: project_id,
                p_amount: credits
            });

            // Reactivate if dormant
            if (project.agent_status === 'dormant') {
                await supabase
                    .from('inclawbator_projects')
                    .update({ agent_status: 'active' })
                    .eq('id', project_id);
            }

            return res.status(200).json({
                credits_added: credits,
                credits_total: newBalance,
                inclawnch_deposited: verification.amount,
                price_usd: livePrice
            });
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
