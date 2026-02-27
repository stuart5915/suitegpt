// Inclawbator — Project Registry API
// GET                              — list active projects (public, cached 60s)
// GET ?wallet=0x...                — projects by creator wallet
// POST action:"register"           — create project (JWT auth)
// POST action:"update-staking"     — set staking address after factory deploy (JWT auth, owner only)
// POST action:"approve"            — admin approves incubated project (admin_secret)
// POST action:"record-distribution"— log reward distribution (admin_secret)
// POST action:"update-fees"        — admin updates total_fees_claimed (admin_secret)

import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

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

        const wallet = req.query.wallet;

        if (wallet) {
            const { data, error } = await supabase
                .from('inclawbator_projects')
                .select('*')
                .eq('creator_wallet', wallet.toLowerCase())
                .order('created_at', { ascending: false });

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ projects: data });
        }

        // Public: only active projects
        const { data, error } = await supabase
            .from('inclawbator_projects')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ projects: data });
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
                fee_split_bps, tier, creator_wallet, color, color_dim, glow
            } = req.body;

            if (!token_name || !token_symbol || !creator_wallet) {
                return res.status(400).json({ error: 'token_name, token_symbol, and creator_wallet are required' });
            }

            const splitBps = parseInt(fee_split_bps) || 10000;
            if (splitBps < 2000 || splitBps > 10000) {
                return res.status(400).json({ error: 'fee_split_bps must be between 2000 (20%) and 10000 (100%)' });
            }

            const projectTier = tier === 'incubated' ? 'incubated' : 'permissionless';
            const status = projectTier === 'permissionless' ? 'active' : 'pending';

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
                    glow: glow || undefined
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

        return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
