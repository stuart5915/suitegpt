// Inclawbator — Project Registry API
// GET                              — list active projects (public, cached 60s)
// GET ?wallet=0x...                — projects by creator wallet
// GET ?distributions=<project_id>  — distribution history for a project
// POST action:"register"           — create project (JWT auth)
// POST action:"update-staking"     — set staking address after factory deploy (JWT auth, owner only)
// POST action:"approve"            — admin approves incubated project (admin_secret)
// POST action:"record-distribution"— log reward distribution (admin_secret)
// POST action:"record-distribution-owner" — log reward distribution (JWT auth, owner only)
// POST action:"update-fees"        — admin updates total_fees_claimed (admin_secret)
// POST action:"feed-agent"         — deposit CLAWS to feed a project's AI agent
// POST action:"delete-application" — owner deletes a pending/rejected application (JWT auth)
// POST action:"update-application" — owner updates application fields (JWT auth)
// POST action:"update-project"          — owner updates appearance (logo, color) (JWT auth)
// POST action:"record-allocation-claim" — owner records on-chain allocation claim (JWT auth)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

// ── Deposit verification (reused from credits.js) ──
const CLAWS_ADDRESS = '0x7ca47B141639B893C6782823C0b219f872056379'.toLowerCase();
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

async function fetchClawsPrice() {
    try {
        const resp = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + CLAWS_ADDRESS);
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
        log.address.toLowerCase() === CLAWS_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No CLAWS transfer found in transaction' };
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

const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';
const VALID_ALLOCATION_PCTS = [0, 1, 2, 5, 10];
const ALLOCATION_BURN_COSTS = { 0: 0, 1: 1000000, 2: 2000000, 5: 5000000, 10: 10000000 };

async function verifyBurnTx(txHash, fromWallet, expectedAmount) {
    const receipt = await rpcCall('eth_getTransactionReceipt', [txHash]);
    if (!receipt || receipt.status !== '0x1') {
        return { valid: false, reason: 'Burn transaction failed or not found' };
    }
    const transferLog = (receipt.logs || []).find(log =>
        log.address.toLowerCase() === CLAWS_ADDRESS &&
        log.topics[0] === ERC20_TRANSFER_TOPIC
    );
    if (!transferLog) {
        return { valid: false, reason: 'No CLAWS transfer found in burn transaction' };
    }
    const from = '0x' + transferLog.topics[1].slice(26).toLowerCase();
    const to = '0x' + transferLog.topics[2].slice(26).toLowerCase();
    const amount = Number(BigInt(transferLog.data)) / 1e18;
    if (to !== DEAD_ADDRESS) {
        return { valid: false, reason: 'Transfer was not sent to the burn address' };
    }
    if (from !== fromWallet.toLowerCase()) {
        return { valid: false, reason: 'Burn was not from the expected wallet' };
    }
    if (amount < expectedAmount) {
        return { valid: false, reason: 'Burn amount insufficient: ' + amount + ' < ' + expectedAmount };
    }
    return { valid: true, amount };
}

const SUPER_ADMIN = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd';

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app'
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
        // Only cache public listings; wallet-specific and ID queries should be fresh
        if (!req.query.wallet && !req.query.id && !req.query.distributions && !req.query.pending) {
            res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
        } else {
            res.setHeader('Cache-Control', 'no-store');
        }

        // Strip secrets, but expose whether X is connected
        function sanitizeProjects(rows) {
            return (rows || []).map(p => {
                const { x_access_token, x_access_secret, x_refresh_token, ...safe } = p;
                safe.x_connected = !!(x_access_token && (x_access_secret || x_refresh_token));
                return safe;
            });
        }

        // Single project by token address
        const tokenAddr = req.query.token_address;
        if (tokenAddr) {
            const { data: project, error: projErr } = await supabase
                .from('inclawbator_projects')
                .select('*')
                .eq('token_address', tokenAddr.startsWith('0x') ? tokenAddr.toLowerCase() : tokenAddr)
                .single();

            if (projErr || !project) return res.status(404).json({ error: 'Project not found' });

            const { x_access_token, x_access_secret, x_refresh_token: _xrt, ...safe } = project;
            safe.x_connected = !!(x_access_token && (x_access_secret || _xrt));
            return res.status(200).json({ project: safe });
        }

        // Single project by ID + agent posts
        const id = req.query.id;
        if (id) {
            const { data: project, error: projErr } = await supabase
                .from('inclawbator_projects')
                .select('*')
                .eq('id', id)
                .single();

            if (projErr || !project) return res.status(404).json({ error: 'Project not found' });

            const { x_access_token, x_access_secret, x_refresh_token: _xrt, ...safe } = project;
            safe.x_connected = !!(x_access_token && (x_access_secret || _xrt));

            // Last 10 agent posts
            const { data: posts } = await supabase
                .from('inclawbator_agent_posts')
                .select('id, tweet_text, tweet_id, status, created_at')
                .eq('project_id', id)
                .eq('status', 'posted')
                .order('created_at', { ascending: false })
                .limit(10);

            return res.status(200).json({ project: safe, agent_posts: posts || [] });
        }

        // Distribution history for a project
        const distProjectId = req.query.distributions;
        if (distProjectId) {
            const { data, error } = await supabase
                .from('inclawbator_distributions')
                .select('*')
                .eq('project_id', distProjectId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ distributions: data || [] });
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

        // Admin: pending applications
        if (req.query.pending === 'true') {
            const reqWallet = (req.headers['x-wallet'] || '').toLowerCase();
            if (reqWallet !== SUPER_ADMIN) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            const { data: pending, error: pendErr } = await supabase
                .from('inclawbator_projects')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (pendErr) return res.status(500).json({ error: pendErr.message });
            return res.status(200).json({ projects: sanitizeProjects(pending) });
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
            const reqWallet = (req.headers['x-wallet'] || '').toLowerCase();
            const user = authenticateRequest(req) || (reqWallet === SUPER_ADMIN ? { sub: null } : null);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const {
                token_address, token_name, token_symbol, deploy_tx_hash,
                description, website_url, x_handle, telegram_url, logo_url,
                fee_split_bps, tier, creator_wallet, color, color_dim, glow,
                agent_enabled, agent_persona, agent_posts_per_day,
                burn_tx_hash, allocation_pct, burn_amount,
                chain, solana_wallet, solana_token_mint,
                cardano_wallet, cardano_policy_id, cardano_asset_name
            } = req.body;

            if (!token_name || !creator_wallet) {
                return res.status(400).json({ error: 'token_name and creator_wallet are required' });
            }

            const splitBps = parseInt(fee_split_bps) || 10000;
            if (splitBps < 2000 || splitBps > 10000) {
                return res.status(400).json({ error: 'fee_split_bps must be between 2000 (20%) and 10000 (100%)' });
            }

            const validTiers = ['incubated', 'permissionless', 'byt', 'ecosystem', 'partner', 'drops'];
            const projectTier = validTiers.includes(tier) ? tier : 'permissionless';
            const status = (projectTier === 'incubated') ? 'pending' : 'active';

            // Allocation validation (free for all tiers)
            const allocPct = parseInt(allocation_pct) || 0;
            if (!VALID_ALLOCATION_PCTS.includes(allocPct)) {
                return res.status(400).json({ error: 'Invalid allocation_pct. Must be 0, 1, 2, 5, or 10.' });
            }
            const verifiedBurnAmount = 0;

            // Agent config
            const wantsAgent = agent_enabled === true;
            const postsPerDay = Math.min(3, Math.max(1, parseInt(agent_posts_per_day) || 2));

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .insert({
                    creator_wallet: creator_wallet.startsWith('0x') ? creator_wallet.toLowerCase() : creator_wallet,
                    creator_profile_id: user.sub || null,
                    token_address: token_address ? (token_address.startsWith('0x') ? token_address.toLowerCase() : token_address) : null,
                    token_name,
                    token_symbol: token_symbol ? token_symbol.toUpperCase() : token_name.slice(0, 10).toUpperCase(),
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
                    agent_posts_per_day: wantsAgent ? postsPerDay : 2,
                    agent_status: wantsAgent ? 'active' : 'dormant',
                    burn_tx_hash: burn_tx_hash || null,
                    allocation_pct: allocPct,
                    burn_amount: verifiedBurnAmount || 0,
                    chain: ['solana', 'cardano'].includes(chain) ? chain : 'base',
                    solana_wallet: (chain === 'solana' && solana_wallet) ? solana_wallet : null,
                    solana_token_mint: (chain === 'solana' && solana_token_mint) ? solana_token_mint : null,
                    cardano_wallet: (chain === 'cardano' && cardano_wallet) ? cardano_wallet : null,
                    cardano_policy_id: (chain === 'cardano' && cardano_policy_id) ? cardano_policy_id : null,
                    cardano_asset_name: (chain === 'cardano' && cardano_asset_name) ? cardano_asset_name : null
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
            const reqWallet = (req.headers['x-wallet'] || '').toLowerCase();
            const user = authenticateRequest(req) || (reqWallet === SUPER_ADMIN ? { sub: SUPER_ADMIN } : null);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, staking_address, staking_deploy_tx } = req.body;
            if (!project_id || !staking_address) {
                return res.status(400).json({ error: 'project_id and staking_address required' });
            }

            // Verify ownership (admin bypass via x-wallet)
            const isAdminStaking = (req.headers['x-wallet'] || '').toLowerCase() === SUPER_ADMIN;
            if (!isAdminStaking) {
                const { data: project } = await supabase
                    .from('inclawbator_projects')
                    .select('creator_profile_id, creator_wallet')
                    .eq('id', project_id)
                    .single();

                if (!project) return res.status(404).json({ error: 'Project not found' });
                const userWallet = (user.wallet_address || '').toLowerCase();
                if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                    return res.status(403).json({ error: 'Not the project owner' });
                }
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

        // ── Admin: reject incubated project ──
        if (action === 'reject') {
            const { project_id, admin_secret, rejection_reason } = req.body;
            const expectedSecret = process.env.INCLAWBATE_ADMIN_SECRET;
            if (!expectedSecret || admin_secret !== expectedSecret) {
                return res.status(403).json({ error: 'Unauthorized' });
            }
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update({
                    status: 'rejected',
                    rejection_reason: rejection_reason || null,
                    updated_at: new Date().toISOString()
                })
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

        // ── Owner: record distribution (JWT auth) ──
        if (action === 'record-distribution-owner') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, staking_address, amount, duration_seconds, tx_hash } = req.body;
            if (!project_id || !staking_address || !amount || !duration_seconds || !tx_hash) {
                return res.status(400).json({ error: 'project_id, staking_address, amount, duration_seconds, tx_hash required' });
            }

            // Verify ownership
            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }

            const { error: distErr } = await supabase
                .from('inclawbator_distributions')
                .insert({
                    project_id,
                    staking_address: staking_address.toLowerCase(),
                    amount,
                    duration_seconds,
                    tx_hash,
                    distributed_by: 'owner'
                });

            if (distErr) {
                if (distErr.code === '23505') return res.status(409).json({ error: 'Distribution tx already recorded' });
                return res.status(500).json({ error: distErr.message });
            }

            // Increment total_rewards_distributed
            const { data: proj } = await supabase
                .from('inclawbator_projects')
                .select('total_rewards_distributed')
                .eq('id', project_id)
                .single();

            if (proj) {
                await supabase
                    .from('inclawbator_projects')
                    .update({
                        total_rewards_distributed: parseFloat(proj.total_rewards_distributed || 0) + parseFloat(amount),
                        last_distribution_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
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

        // ── Feed agent — deposit CLAWS to add credits ──
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
            const livePrice = await fetchClawsPrice();
            if (livePrice <= 0) {
                return res.status(503).json({ error: 'Unable to fetch CLAWS price. Try again shortly.' });
            }

            const tokensPerCredit = TARGET_USD_PER_CREDIT / livePrice;
            const credits = Math.floor(verification.amount / tokensPerCredit);
            if (credits <= 0) {
                return res.status(400).json({ error: `Deposit too small. Min ~${Math.ceil(tokensPerCredit)} CLAWS for 1 credit.` });
            }

            // Record deposit
            const { error: insertErr } = await supabase
                .from('inclawbator_agent_deposits')
                .insert({
                    project_id,
                    depositor_wallet: 'unknown', // no auth required to feed
                    tx_hash: tx_hash.toLowerCase(),
                    claws_amount: verification.amount,
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
                claws_deposited: verification.amount,
                price_usd: livePrice
            });
        }

        // ── Owner: update project appearance (logo, color) ──
        if (action === 'update-project') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, logo_url, color, color_dim, glow, description, website_url, x_handle, telegram_url, marketing_plan } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }

            const updates = { updated_at: new Date().toISOString() };
            if (logo_url !== undefined) updates.logo_url = logo_url || null;
            if (color !== undefined) updates.color = color || null;
            if (color_dim !== undefined) updates.color_dim = color_dim || null;
            if (glow !== undefined) updates.glow = glow || null;
            if (description !== undefined) updates.description = description || null;
            if (website_url !== undefined) updates.website_url = website_url || null;
            if (x_handle !== undefined) updates.x_handle = x_handle || null;
            if (telegram_url !== undefined) updates.telegram_url = telegram_url || null;
            if (marketing_plan !== undefined) {
                updates.marketing_plan = marketing_plan || null;
                updates.marketing_plan_generated_at = marketing_plan ? new Date().toISOString() : null;
            }

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update(updates)
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            const { x_access_token: _t, x_access_secret: _s, x_refresh_token: _r, ...safeResult } = data;
            safeResult.x_connected = !!(_t && (_s || _r));
            return res.status(200).json({ project: safeResult });
        }

        // ── Owner: update agent settings ──
        if (action === 'update-agent') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, agent_persona, agent_posts_per_day, agent_status } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }

            const { agent_enabled } = req.body;
            const updates = { updated_at: new Date().toISOString() };
            if (agent_persona !== undefined) updates.agent_persona = agent_persona || null;
            if (agent_posts_per_day !== undefined) {
                updates.agent_posts_per_day = Math.min(3, Math.max(1, parseInt(agent_posts_per_day) || 2));
            }
            if (agent_status === 'active' || agent_status === 'paused') {
                updates.agent_status = agent_status;
            }
            if (agent_enabled === true || agent_enabled === false) {
                updates.agent_enabled = agent_enabled;
            }

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update(updates)
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            const { x_access_token: _t, x_access_secret: _s, x_refresh_token: _r, ...safeResult } = data;
            safeResult.x_connected = !!(_t && (_s || _r));
            return res.status(200).json({ project: safeResult });
        }

        // ── Owner: disconnect X ──
        if (action === 'disconnect-x') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, creator_wallet')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }

            const { error } = await supabase
                .from('inclawbator_projects')
                .update({
                    x_access_token: null,
                    x_access_secret: null,
                    x_handle: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', project_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Launch AI agent for an existing app ──
        if (action === 'launch-agent') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { app_id, agent_persona, agent_posts_per_day, creator_wallet } = req.body;
            if (!app_id) return res.status(400).json({ error: 'app_id required' });
            if (!creator_wallet) return res.status(400).json({ error: 'creator_wallet required' });

            // Verify app exists in user_apps
            const { data: app, error: appErr } = await supabase
                .from('user_apps')
                .select('id, name, slug, description')
                .eq('id', app_id)
                .maybeSingle();

            if (appErr || !app) return res.status(404).json({ error: 'App not found' });

            const postsPerDay = Math.min(3, Math.max(1, parseInt(agent_posts_per_day) || 2));

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .insert({
                    creator_wallet: creator_wallet.toLowerCase(),
                    creator_profile_id: user.sub || null,
                    token_name: app.name,
                    token_symbol: (app.slug || app.name.slice(0, 10)).toUpperCase(),
                    description: app.description || null,
                    website_url: app.id,
                    tier: 'agent',
                    status: 'active',
                    fee_split_bps: 10000,
                    agent_enabled: true,
                    agent_persona: agent_persona || null,
                    agent_posts_per_day: postsPerDay,
                    agent_status: 'active'
                })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ project: data });
        }

        // ── Owner: delete application ──
        if (action === 'delete-application') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, status, token_address')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }
            if (!['pending', 'rejected'].includes(project.status)) {
                return res.status(400).json({ error: 'Can only delete pending or rejected applications' });
            }

            const { error } = await supabase
                .from('inclawbator_projects')
                .delete()
                .eq('id', project_id);

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true });
        }

        // ── Owner: update application ──
        if (action === 'update-application') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, token_name, description, logo_url } = req.body;
            if (!project_id) return res.status(400).json({ error: 'project_id required' });

            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, token_address')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }
            if (project.token_address) {
                return res.status(400).json({ error: 'Cannot edit projects with a launched token' });
            }

            const updates = { updated_at: new Date().toISOString() };
            if (token_name !== undefined) updates.token_name = token_name;
            if (description !== undefined) updates.description = description;
            if (logo_url !== undefined) updates.logo_url = logo_url || null;

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update(updates)
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ project: data });
        }

        // ── Owner: record allocation claim ──
        if (action === 'record-allocation-claim') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { project_id, claim_tx_hash, wallet } = req.body;
            if (!project_id || !claim_tx_hash || !wallet) {
                return res.status(400).json({ error: 'project_id, claim_tx_hash, and wallet required' });
            }

            // Verify ownership
            const { data: project } = await supabase
                .from('inclawbator_projects')
                .select('creator_profile_id, allocation_pct, allocation_claimed_at')
                .eq('id', project_id)
                .single();

            if (!project) return res.status(404).json({ error: 'Project not found' });
            const userWallet = (user.wallet_address || '').toLowerCase();
            if (project.creator_profile_id !== user.sub && (!userWallet || project.creator_wallet !== userWallet)) {
                return res.status(403).json({ error: 'Not the project owner' });
            }
            if (project.allocation_claimed_at) {
                return res.status(409).json({ error: 'Allocation already claimed' });
            }
            if (!project.allocation_pct || project.allocation_pct <= 0) {
                return res.status(400).json({ error: 'No allocation to claim' });
            }

            const { data, error } = await supabase
                .from('inclawbator_projects')
                .update({
                    allocation_claimed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', project_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ ok: true, project: data });
        }

        // ══════════════════════════════════════
        // BAGS API PROXY (Solana token launches)
        // ══════════════════════════════════════

        const BAGS_API = 'https://public-api-v2.bags.fm/api/v1';
        const BAGS_KEY = process.env.BAGS_API_KEY;
        const INCLAWBATE_SOL_TREASURY = process.env.INCLAWBATE_SOL_TREASURY;

        // ── Create token info on Bags ──
        if (action === 'bags-create-token') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });
            if (!BAGS_KEY) return res.status(500).json({ error: 'Bags API not configured' });

            const { name, symbol, description: desc, image_url, website_url, twitter, telegram } = req.body;
            if (!name || !symbol) return res.status(400).json({ error: 'name and symbol required' });

            try {
                const body = { name, symbol, description: desc || '' };
                if (image_url) body.imageUrl = image_url;
                if (website_url) body.website = website_url;
                if (twitter) body.twitter = twitter;
                if (telegram) body.telegram = telegram;

                const resp = await fetch(BAGS_API + '/token-launch/create-token-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BAGS_KEY },
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                if (!resp.ok) return res.status(resp.status).json({ error: data.message || data.error || JSON.stringify(data) });
                return res.status(200).json(data);
            } catch (e) {
                return res.status(500).json({ error: 'Bags API request failed: ' + e.message });
            }
        }

        // ── Configure fee sharing on Bags ──
        if (action === 'bags-fee-config') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });
            if (!BAGS_KEY || !INCLAWBATE_SOL_TREASURY) return res.status(500).json({ error: 'Bags API not configured' });

            const { token_mint, creator_solana_wallet } = req.body;
            if (!token_mint || !creator_solana_wallet) return res.status(400).json({ error: 'token_mint and creator_solana_wallet required' });

            try {
                // If creator wallet === treasury, send 100% to one address (no duplicates)
                const sameWallet = creator_solana_wallet === INCLAWBATE_SOL_TREASURY;
                const claimers = sameWallet ? [creator_solana_wallet] : [creator_solana_wallet, INCLAWBATE_SOL_TREASURY];
                const bps = sameWallet ? [10000] : [8000, 2000];

                const resp = await fetch(BAGS_API + '/fee-share/config', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BAGS_KEY },
                    body: JSON.stringify({
                        payer: creator_solana_wallet,
                        baseMint: token_mint,
                        claimersArray: claimers,
                        basisPointsArray: bps
                    })
                });
                const data = await resp.json();
                if (!resp.ok) return res.status(resp.status).json({ error: data.message || data.error || JSON.stringify(data) });
                return res.status(200).json(data);
            } catch (e) {
                return res.status(500).json({ error: 'Bags fee config failed: ' + e.message });
            }
        }

        // ── Get claimable fee positions from Bags ──
        if (action === 'bags-claimable-fees') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });
            if (!BAGS_KEY) return res.status(500).json({ error: 'Bags API not configured' });

            const { solana_wallet } = req.body;
            if (!solana_wallet) return res.status(400).json({ error: 'solana_wallet required' });

            try {
                const resp = await fetch(BAGS_API + '/token-launch/claimable-positions?wallet=' + encodeURIComponent(solana_wallet), {
                    headers: { 'x-api-key': BAGS_KEY }
                });
                const data = await resp.json();
                if (!resp.ok) return res.status(resp.status).json({ error: data.message || data.error || JSON.stringify(data) });
                return res.status(200).json(data);
            } catch (e) {
                return res.status(500).json({ error: 'Bags claimable fees failed: ' + e.message });
            }
        }

        // ── Get claim transaction from Bags ──
        if (action === 'bags-claim-tx') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });
            if (!BAGS_KEY) return res.status(500).json({ error: 'Bags API not configured' });

            const { solana_wallet, token_mint } = req.body;
            if (!solana_wallet || !token_mint) return res.status(400).json({ error: 'solana_wallet and token_mint required' });

            try {
                const resp = await fetch(BAGS_API + '/token-launch/claim-txs/v3', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BAGS_KEY },
                    body: JSON.stringify({ feeClaimer: solana_wallet, tokenMint: token_mint })
                });
                const text = await resp.text();
                let data;
                try { data = JSON.parse(text); } catch (e) {
                    return res.status(502).json({ error: 'Bags API returned invalid response: ' + text.slice(0, 200) });
                }
                if (!resp.ok) return res.status(resp.status).json({ error: data.message || data.error || JSON.stringify(data) });
                return res.status(200).json(data);
            } catch (e) {
                return res.status(500).json({ error: 'Bags claim tx failed: ' + e.message });
            }
        }

        // ── Create launch transaction on Bags ──
        if (action === 'bags-create-launch-tx') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });
            if (!BAGS_KEY) return res.status(500).json({ error: 'Bags API not configured' });

            const { token_mint, creator_solana_wallet, initial_buy_lamports, config_key, metadata_url } = req.body;
            if (!token_mint || !creator_solana_wallet) return res.status(400).json({ error: 'token_mint and creator_solana_wallet required' });

            try {
                const body = {
                    tokenMint: token_mint,
                    wallet: creator_solana_wallet,
                    initialBuyLamports: initial_buy_lamports || 0
                };
                if (config_key) body.configKey = config_key;
                if (metadata_url) body.ipfs = metadata_url;

                const resp = await fetch(BAGS_API + '/token-launch/create-launch-transaction', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': BAGS_KEY },
                    body: JSON.stringify(body)
                });
                const data = await resp.json();
                if (!resp.ok) return res.status(resp.status).json({ error: data.message || data.error || JSON.stringify(data) });
                return res.status(200).json(data);
            } catch (e) {
                return res.status(500).json({ error: 'Bags launch tx failed: ' + e.message });
            }
        }

        // ══════════════════════════════════════
        // CARDANO — Mint Token (via Lucid + Blockfrost)
        // ══════════════════════════════════════
        if (action === 'cardano-mint-token') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { name, symbol, description, image_url, creator_cardano_address } = req.body;
            if (!name || !symbol || !creator_cardano_address) {
                return res.status(400).json({ error: 'name, symbol, and creator_cardano_address required' });
            }

            try {
                const { Lucid, Blockfrost, fromHex, toHex, C } = await import('lucid-cardano');

                const blockfrostKey = process.env.BLOCKFROST_API_KEY;
                if (!blockfrostKey) return res.status(500).json({ error: 'Blockfrost API key not configured' });

                const lucid = await Lucid.new(
                    new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', blockfrostKey),
                    'Mainnet'
                );

                // Select the creator's wallet (external — we just need their address for building)
                lucid.selectWalletFrom({ address: creator_cardano_address });

                // Create a native script minting policy — requires creator's key to sign
                // Extract the key hash from the address
                const addressDetails = lucid.utils.getAddressDetails(creator_cardano_address);
                const keyHash = addressDetails.paymentCredential?.hash;
                if (!keyHash) return res.status(400).json({ error: 'Could not extract key hash from Cardano address' });

                const mintingPolicy = lucid.utils.nativeScriptFromJson({
                    type: 'sig',
                    keyHash: keyHash
                });
                const policyId = lucid.utils.mintingPolicyToId(mintingPolicy);

                // Asset name in hex
                const assetNameHex = Buffer.from(symbol).toString('hex');
                const unit = policyId + assetNameHex;

                // Total supply: 100 billion tokens
                const totalSupply = 100000000000n;

                // Build the minting transaction
                const tx = await lucid.newTx()
                    .mintAssets({ [unit]: totalSupply }, undefined)
                    .attachMintingPolicy(mintingPolicy)
                    .payToAddress(creator_cardano_address, { [unit]: totalSupply })
                    .complete();

                const unsignedTx = tx.toString(); // CBOR hex

                return res.status(200).json({
                    unsignedTx,
                    policyId,
                    assetName: assetNameHex,
                    unit,
                    totalSupply: totalSupply.toString()
                });
            } catch (e) {
                console.error('Cardano mint error:', e);
                return res.status(500).json({ error: 'Cardano mint failed: ' + e.message });
            }
        }

        // ══════════════════════════════════════
        // CARDANO — Create Minswap Pool
        // ══════════════════════════════════════
        if (action === 'cardano-create-pool-tx') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { policy_id, asset_name, creator_cardano_address, ada_amount, mint_tx_hash } = req.body;
            if (!policy_id || !asset_name || !creator_cardano_address || !ada_amount) {
                return res.status(400).json({ error: 'policy_id, asset_name, creator_cardano_address, and ada_amount required' });
            }

            if (ada_amount < 2) {
                return res.status(400).json({ error: 'Minimum 2 ADA required for pool creation' });
            }

            try {
                const { Lucid, Blockfrost } = await import('lucid-cardano');

                const blockfrostKey = process.env.BLOCKFROST_API_KEY;
                if (!blockfrostKey) return res.status(500).json({ error: 'Blockfrost API key not configured' });

                const lucid = await Lucid.new(
                    new Blockfrost('https://cardano-mainnet.blockfrost.io/api/v0', blockfrostKey),
                    'Mainnet'
                );

                lucid.selectWalletFrom({ address: creator_cardano_address });

                // Wait for mint tx to propagate
                if (mint_tx_hash) {
                    await new Promise(r => setTimeout(r, 5000));
                }

                const tokenUnit = policy_id + asset_name;
                const adaLovelace = BigInt(Math.round(ada_amount * 1000000));
                // Use 50% of total supply for initial LP
                const tokenAmount = 50000000000n;

                // Build a transaction that sends ADA + tokens to the creator
                // (pool creation on Minswap requires interacting with their contracts,
                // which is complex — instead, we prepare the liquidity and direct users
                // to create the pool on Minswap's UI with these funds)
                const tx = await lucid.newTx()
                    .payToAddress(creator_cardano_address, {
                        lovelace: adaLovelace,
                        [tokenUnit]: tokenAmount
                    })
                    .complete();

                const unsignedTx = tx.toString();

                return res.status(200).json({
                    unsignedTx,
                    poolNote: 'Liquidity prepared. After this transaction confirms, visit Minswap to create the ADA/' + asset_name + ' trading pair.',
                    adaAmount: ada_amount,
                    tokenAmount: tokenAmount.toString()
                });
            } catch (e) {
                console.error('Cardano pool error:', e);
                return res.status(500).json({ error: 'Pool creation failed: ' + e.message });
            }
        }

        // ══════════════════════════════════════
        // CARDANO — Submit Signed Transaction (fallback)
        // ══════════════════════════════════════
        if (action === 'cardano-submit-tx') {
            const user = authenticateRequest(req);
            if (!user) return res.status(401).json({ error: 'Authentication required' });

            const { signed_tx } = req.body;
            if (!signed_tx) return res.status(400).json({ error: 'signed_tx required' });

            try {
                const blockfrostKey = process.env.BLOCKFROST_API_KEY;
                if (!blockfrostKey) return res.status(500).json({ error: 'Blockfrost API key not configured' });

                // Submit via Blockfrost REST API
                const submitResp = await fetch('https://cardano-mainnet.blockfrost.io/api/v0/tx/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/cbor',
                        'project_id': blockfrostKey
                    },
                    body: Buffer.from(signed_tx, 'hex')
                });

                if (!submitResp.ok) {
                    const errData = await submitResp.json().catch(() => ({}));
                    return res.status(submitResp.status).json({ error: errData.message || 'Blockfrost submit failed' });
                }

                const txHash = await submitResp.text();
                return res.status(200).json({ txHash: txHash.replace(/"/g, '') });
            } catch (e) {
                console.error('Cardano submit error:', e);
                return res.status(500).json({ error: 'Submit failed: ' + e.message });
            }
        }

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
