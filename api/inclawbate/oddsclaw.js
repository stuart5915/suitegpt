// OddsClaw — Prediction Market API
// GET: list markets, market detail, positions, leaderboard
// POST: create market, trade (buy/sell), resolve, dispute, faucet

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
    'https://oddsclaw.app',
    'https://www.oddsclaw.app',
    'http://localhost:3000'
];

const TRADING_FEE = 0.02; // 2%
const MARKET_CREATION_COST = 100; // ODDS burned to create
const MIN_INITIAL_LIQUIDITY = 200; // minimum ODDS to seed pool
const DISPUTE_STAKE = 500; // ODDS to file a dispute
const DISPUTE_WINDOW_HOURS = 24;
const PLATFORM_WALLET = '0x91b5c0d07859cfeafeb67d9694121cd741f049bd'; // fee collection

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function cors(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ──────────────────────────────────────────────
// AMM Math (for estimates — actual trades use DB functions)
// ──────────────────────────────────────────────
function getProbs(yesPool, noPool) {
    const total = yesPool + noPool;
    if (total === 0) return { yes: 0.5, no: 0.5 };
    return { yes: noPool / total, no: yesPool / total };
}

// ──────────────────────────────────────────────
// GET handlers
// ──────────────────────────────────────────────
async function listMarkets(req, res) {
    const { category, status: st, sort, limit: lim, page: pg } = req.query;
    const status = st || 'active';
    const limit = Math.min(50, parseInt(lim) || 20);
    const page = parseInt(pg) || 1;
    const from = (page - 1) * limit;

    let query = supabase
        .from('oddsclaw_markets')
        .select('*')
        .eq('status', status)
        .range(from, from + limit - 1);

    if (category && category !== 'all') query = query.eq('category', category);

    if (sort === 'volume') query = query.order('total_volume', { ascending: false });
    else if (sort === 'closing') query = query.order('close_time', { ascending: true });
    else if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else if (sort === 'trades') query = query.order('trade_count', { ascending: false });
    else query = query.order('total_volume', { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: 'Failed to load markets' });

    const markets = (data || []).map(m => ({
        ...m,
        probs: getProbs(parseFloat(m.yes_pool), parseFloat(m.no_pool))
    }));

    return res.status(200).json({ markets, page, limit });
}

async function getMarketDetail(req, res) {
    const { id } = req.query;
    const { data: market, error } = await supabase
        .from('oddsclaw_markets')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !market) return res.status(404).json({ error: 'Market not found' });

    const { data: trades } = await supabase
        .from('oddsclaw_trades')
        .select('*')
        .eq('market_id', id)
        .order('created_at', { ascending: false })
        .limit(50);

    market.probs = getProbs(parseFloat(market.yes_pool), parseFloat(market.no_pool));

    return res.status(200).json({ market, trades: trades || [] });
}

async function getPositions(req, res) {
    const wallet = (req.query.wallet || '').toLowerCase();
    if (!wallet) return res.status(400).json({ error: 'Wallet required' });

    const [posRes, walletRes] = await Promise.all([
        supabase
            .from('oddsclaw_positions')
            .select('*, oddsclaw_markets(question, slug, status, resolved_outcome, yes_pool, no_pool, close_time)')
            .eq('wallet_address', wallet)
            .gt('shares', 0)
            .order('updated_at', { ascending: false }),
        supabase
            .from('oddsclaw_wallets')
            .select('*')
            .eq('wallet_address', wallet)
            .single()
    ]);

    const positions = (posRes.data || []).map(p => {
        const m = p.oddsclaw_markets;
        if (m) {
            p.market_question = m.question;
            p.market_slug = m.slug;
            p.market_status = m.status;
            p.resolved_outcome = m.resolved_outcome;
            p.probs = getProbs(parseFloat(m.yes_pool), parseFloat(m.no_pool));
        }
        delete p.oddsclaw_markets;
        return p;
    });

    return res.status(200).json({
        positions,
        balance: walletRes.data ? parseFloat(walletRes.data.odds_balance) : 0,
        wallet_info: walletRes.data || null
    });
}

async function getLeaderboard(req, res) {
    const { data } = await supabase
        .from('oddsclaw_leaderboard')
        .select('*')
        .order('total_pnl', { ascending: false })
        .limit(50);

    return res.status(200).json({ leaderboard: data || [] });
}

// ──────────────────────────────────────────────
// POST handlers
// ──────────────────────────────────────────────
async function createMarket(req, res) {
    const { wallet, question, description, category, resolution_type, resolution_source,
            resolution_criteria, resolution_target, resolution_comparator,
            close_time, resolution_time, initial_liquidity, image_url, tags } = req.body;

    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'Wallet required' });
    if (!question || question.trim().length < 10) return res.status(400).json({ error: 'Question must be at least 10 characters' });
    if (!close_time || !resolution_time) return res.status(400).json({ error: 'Close time and resolution time required' });

    const closeDate = new Date(close_time);
    const resolveDate = new Date(resolution_time);
    if (closeDate <= new Date()) return res.status(400).json({ error: 'Close time must be in the future' });
    if (resolveDate < closeDate) return res.status(400).json({ error: 'Resolution time must be after close time' });

    const liquidity = Math.max(MIN_INITIAL_LIQUIDITY, parseFloat(initial_liquidity) || MIN_INITIAL_LIQUIDITY);
    const totalCost = MARKET_CREATION_COST + liquidity;

    // Atomic debit — checks balance + debits in one locked operation
    const { data: newBal, error: debitErr } = await supabase.rpc('oddsclaw_debit_wallet', {
        p_wallet: w, p_amount: totalCost
    });
    if (debitErr) {
        return res.status(400).json({ error: debitErr.message || `Need ${totalCost} ODDS (${MARKET_CREATION_COST} fee + ${liquidity} liquidity)` });
    }

    // Credit creation fee to platform wallet (not burned — platform revenue)
    await supabase.rpc('oddsclaw_credit_wallet', {
        p_wallet: PLATFORM_WALLET, p_amount: MARKET_CREATION_COST
    });

    // Generate unique slug
    let slug = slugify(question);
    const { data: existing } = await supabase.from('oddsclaw_markets').select('slug').eq('slug', slug).single();
    if (existing) slug = slug + '-' + Date.now().toString(36);

    const halfLiquidity = liquidity / 2;

    // Create market
    const { data: market, error: createErr } = await supabase
        .from('oddsclaw_markets')
        .insert({
            slug,
            question: question.trim(),
            description: (description || '').trim().slice(0, 2000) || null,
            category: category || 'custom',
            resolution_type: resolution_type || 'creator',
            resolution_source: resolution_source || null,
            resolution_criteria: (resolution_criteria || '').trim() || null,
            resolution_target: resolution_target || null,
            resolution_comparator: resolution_comparator || null,
            close_time: closeDate.toISOString(),
            resolution_time: resolveDate.toISOString(),
            yes_pool: halfLiquidity,
            no_pool: halfLiquidity,
            liquidity_odds: liquidity,
            creator_wallet: w,
            creation_fee_odds: MARKET_CREATION_COST,
            image_url: image_url || null,
            tags: tags || []
        })
        .select('*')
        .single();

    if (createErr) {
        // Refund on failure
        await supabase.rpc('oddsclaw_credit_wallet', { p_wallet: w, p_amount: totalCost });
        await supabase.rpc('oddsclaw_debit_wallet', { p_wallet: PLATFORM_WALLET, p_amount: MARKET_CREATION_COST }).catch(() => {});
        console.error('Market creation error:', createErr);
        return res.status(500).json({ error: 'Failed to create market' });
    }

    // Update leaderboard
    await supabase.rpc('increment_oddsclaw_leaderboard', { p_wallet: w, p_field: 'markets_created', p_amount: 1 }).catch(() => {});

    market.probs = getProbs(halfLiquidity, halfLiquidity);
    return res.status(200).json({ success: true, market });
}

async function trade(req, res) {
    const { wallet, market_id, side, odds_amount: rawAmount, shares_amount: rawShares, direction } = req.body;

    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'Wallet required' });
    if (!market_id) return res.status(400).json({ error: 'Market ID required' });
    if (!side || !['yes', 'no'].includes(side)) return res.status(400).json({ error: 'Side must be yes or no' });

    const dir = direction || 'buy';

    if (dir === 'buy') {
        const amount = parseFloat(rawAmount);
        if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

        // Atomic buy — locks market + wallet, calculates AMM, updates everything
        const { data, error } = await supabase.rpc('oddsclaw_execute_buy', {
            p_wallet: w,
            p_market_id: market_id,
            p_side: side,
            p_amount: amount,
            p_fee_rate: TRADING_FEE,
            p_platform_wallet: PLATFORM_WALLET
        });

        if (error) {
            return res.status(400).json({ error: error.message || 'Trade failed' });
        }

        return res.status(200).json({
            success: true,
            shares: parseFloat(data.shares),
            price: parseFloat(data.price),
            fee: parseFloat(data.fee),
            yes_pool: parseFloat(data.yes_pool),
            no_pool: parseFloat(data.no_pool),
            new_probs: getProbs(parseFloat(data.yes_pool), parseFloat(data.no_pool))
        });

    } else if (dir === 'sell') {
        const shares = parseFloat(rawShares || rawAmount); // accept either field name
        if (!shares || shares <= 0) return res.status(400).json({ error: 'Shares amount must be positive' });

        // Atomic sell — locks market + position, calculates AMM, updates everything
        const { data, error } = await supabase.rpc('oddsclaw_execute_sell', {
            p_wallet: w,
            p_market_id: market_id,
            p_side: side,
            p_shares: shares,
            p_fee_rate: TRADING_FEE,
            p_platform_wallet: PLATFORM_WALLET
        });

        if (error) {
            return res.status(400).json({ error: error.message || 'Sell failed' });
        }

        return res.status(200).json({
            success: true,
            payout: parseFloat(data.payout),
            fee: parseFloat(data.fee),
            yes_pool: parseFloat(data.yes_pool),
            no_pool: parseFloat(data.no_pool),
            new_probs: getProbs(parseFloat(data.yes_pool), parseFloat(data.no_pool))
        });
    }

    return res.status(400).json({ error: 'Direction must be buy or sell' });
}

async function resolveMarket(req, res) {
    const { wallet, market_id, outcome } = req.body;
    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'Wallet required' });
    if (!market_id) return res.status(400).json({ error: 'Market ID required' });
    if (!outcome || !['yes', 'no', 'void'].includes(outcome)) return res.status(400).json({ error: 'Outcome must be yes, no, or void' });

    const { data: market, error } = await supabase
        .from('oddsclaw_markets')
        .select('*')
        .eq('id', market_id)
        .single();

    if (error || !market) return res.status(404).json({ error: 'Market not found' });
    if (market.status !== 'active' && market.status !== 'closed') return res.status(400).json({ error: 'Market cannot be resolved' });
    if (market.creator_wallet !== w) return res.status(403).json({ error: 'Only market creator can resolve' });

    const now = new Date();
    const resTime = new Date(market.resolution_time);
    if (now < resTime) return res.status(400).json({ error: 'Resolution time has not passed yet' });

    const disputeDeadline = new Date(now.getTime() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);

    // Atomically set resolved — only if still active/closed (prevents double resolution)
    const { data: updated, error: updateErr } = await supabase.from('oddsclaw_markets')
        .update({
            resolved_outcome: outcome,
            resolved_at: now.toISOString(),
            resolved_by: w,
            dispute_deadline: disputeDeadline.toISOString(),
            status: 'resolved'
        })
        .eq('id', market_id)
        .in('status', ['active', 'closed'])
        .select('id');

    if (updateErr || !updated || updated.length === 0) {
        return res.status(400).json({ error: 'Market already resolved or update failed' });
    }

    // Distribute pool to winners (or refund on void)
    if (outcome !== 'void') {
        await creditWinners(market_id, outcome);
    } else {
        await refundAll(market_id);
    }

    return res.status(200).json({ success: true, outcome, dispute_deadline: disputeDeadline.toISOString() });
}

// ──────────────────────────────────────────────
// Resolution: distribute pool to winners proportionally
// ──────────────────────────────────────────────
async function creditWinners(marketId, outcome) {
    // Re-fetch market for fresh pool values (not stale from earlier read)
    const { data: freshMarket } = await supabase
        .from('oddsclaw_markets')
        .select('yes_pool, no_pool, creator_wallet')
        .eq('id', marketId)
        .single();

    if (!freshMarket) return;

    const totalPool = parseFloat(freshMarket.yes_pool) + parseFloat(freshMarket.no_pool);
    if (totalPool <= 0) return;

    // Get all positions on winning side
    const { data: winners } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .eq('side', outcome)
        .gt('shares', 0)
        .eq('claimed', false);

    if (!winners || winners.length === 0) {
        // No winners — return pool to market creator
        await supabase.rpc('oddsclaw_credit_wallet', {
            p_wallet: freshMarket.creator_wallet, p_amount: totalPool
        }).catch(() => {});
        return;
    }

    // Total winning shares
    const totalWinningShares = winners.reduce((sum, p) => sum + parseFloat(p.shares), 0);

    // Each winner gets proportional share of the entire pool
    for (const pos of winners) {
        const shares = parseFloat(pos.shares);
        const payout = (shares / totalWinningShares) * totalPool;

        await supabase.rpc('oddsclaw_credit_wallet', {
            p_wallet: pos.wallet_address, p_amount: payout
        });

        await supabase.from('oddsclaw_positions')
            .update({ claimed: true, claimed_amount: payout })
            .eq('id', pos.id);

        await updateLeaderboard(pos.wallet_address, payout - parseFloat(pos.total_cost), payout, true);
    }

    // Mark losers
    const losingSide = outcome === 'yes' ? 'no' : 'yes';
    const { data: losers } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .eq('side', losingSide)
        .gt('shares', 0)
        .eq('claimed', false);

    if (losers) {
        for (const pos of losers) {
            await supabase.from('oddsclaw_positions')
                .update({ claimed: true, claimed_amount: 0 })
                .eq('id', pos.id);
            await updateLeaderboard(pos.wallet_address, -parseFloat(pos.total_cost), 0, false);
        }
    }
}

async function refundAll(marketId) {
    // Re-fetch market for fresh pool values
    const { data: freshMarket } = await supabase
        .from('oddsclaw_markets')
        .select('yes_pool, no_pool, creator_wallet')
        .eq('id', marketId)
        .single();

    if (!freshMarket) return;

    const totalPool = parseFloat(freshMarket.yes_pool) + parseFloat(freshMarket.no_pool);
    if (totalPool <= 0) return;

    const { data: positions } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .gt('shares', 0)
        .eq('claimed', false);

    if (!positions || positions.length === 0) {
        // No positions — return pool to creator
        await supabase.rpc('oddsclaw_credit_wallet', {
            p_wallet: freshMarket.creator_wallet, p_amount: totalPool
        }).catch(() => {});
        return;
    }

    // Proportional refund based on remaining shares (not total_cost, which isn't reduced on sell)
    const totalShares = positions.reduce((sum, p) => sum + parseFloat(p.shares), 0);

    for (const pos of positions) {
        // Each person gets their proportion of the pool based on shares held
        const refund = totalShares > 0
            ? (parseFloat(pos.shares) / totalShares) * totalPool
            : 0;

        if (refund > 0) {
            await supabase.rpc('oddsclaw_credit_wallet', {
                p_wallet: pos.wallet_address, p_amount: refund
            });
        }

        await supabase.from('oddsclaw_positions')
            .update({ claimed: true, claimed_amount: refund })
            .eq('id', pos.id);
    }
}

async function updateLeaderboard(wallet, pnl, volume, isWin) {
    const { data: existing } = await supabase
        .from('oddsclaw_leaderboard')
        .select('*')
        .eq('wallet_address', wallet)
        .single();

    if (existing) {
        await supabase.from('oddsclaw_leaderboard')
            .update({
                total_pnl: parseFloat(existing.total_pnl) + pnl,
                total_volume: parseFloat(existing.total_volume) + volume,
                total_trades: (existing.total_trades || 0) + 1,
                win_count: (existing.win_count || 0) + (isWin ? 1 : 0),
                loss_count: (existing.loss_count || 0) + (isWin ? 0 : 1)
            })
            .eq('wallet_address', wallet);
    } else {
        await supabase.from('oddsclaw_leaderboard')
            .insert({
                wallet_address: wallet,
                total_pnl: pnl,
                total_volume: volume,
                total_trades: 1,
                win_count: isWin ? 1 : 0,
                loss_count: isWin ? 0 : 1
            });
    }
}

async function disputeMarket(req, res) {
    const { wallet, market_id, reason, proposed_outcome } = req.body;
    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'Wallet required' });
    if (!reason || reason.trim().length < 10) return res.status(400).json({ error: 'Reason required (min 10 chars)' });
    if (!proposed_outcome || !['yes', 'no', 'void'].includes(proposed_outcome)) {
        return res.status(400).json({ error: 'Proposed outcome must be yes, no, or void' });
    }

    const { data: market } = await supabase
        .from('oddsclaw_markets')
        .select('*')
        .eq('id', market_id)
        .single();

    if (!market) return res.status(404).json({ error: 'Market not found' });
    if (market.status !== 'resolved') return res.status(400).json({ error: 'Market must be resolved to dispute' });
    if (new Date() > new Date(market.dispute_deadline)) return res.status(400).json({ error: 'Dispute window has closed' });

    // Atomic debit for stake
    const { error: debitErr } = await supabase.rpc('oddsclaw_debit_wallet', {
        p_wallet: w, p_amount: DISPUTE_STAKE
    });
    if (debitErr) {
        return res.status(400).json({ error: debitErr.message || `Need ${DISPUTE_STAKE} ODDS to dispute` });
    }

    // Create dispute
    const { data: dispute, error } = await supabase
        .from('oddsclaw_disputes')
        .insert({
            market_id, disputer_wallet: w, stake_odds: DISPUTE_STAKE,
            reason: reason.trim(), proposed_outcome
        })
        .select('*')
        .single();

    if (error) {
        await supabase.rpc('oddsclaw_credit_wallet', { p_wallet: w, p_amount: DISPUTE_STAKE });
        return res.status(500).json({ error: 'Failed to create dispute' });
    }

    await supabase.from('oddsclaw_markets').update({ status: 'disputed' }).eq('id', market_id);

    return res.status(200).json({ success: true, dispute });
}

// ──────────────────────────────────────────────
// Test faucet (disabled once real token is live)
// ──────────────────────────────────────────────
async function faucet(req, res) {
    const { wallet } = req.body;
    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'Wallet required' });

    const { data: existing } = await supabase
        .from('oddsclaw_wallets')
        .select('*')
        .eq('wallet_address', w)
        .single();

    if (existing) {
        const bal = parseFloat(existing.odds_balance);
        if (bal >= 5000) return res.status(400).json({ error: 'You already have enough test ODDS' });

        // Cooldown: check last update (faucet credits trigger updated_at)
        const lastUpdate = new Date(existing.updated_at || 0);
        const cooldownMs = 60 * 60 * 1000; // 1 hour
        if (Date.now() - lastUpdate.getTime() < cooldownMs) {
            return res.status(429).json({ error: 'Faucet cooldown — try again in an hour' });
        }
    }

    const newBal = await supabase.rpc('oddsclaw_credit_wallet', { p_wallet: w, p_amount: 10000 });

    return res.status(200).json({ success: true, balance: parseFloat(newBal.data) || 10000 });
}

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────
export default async function handler(req, res) {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            if (req.query.id) return getMarketDetail(req, res);
            if (req.query.wallet) return getPositions(req, res);
            if (req.query.leaderboard) return getLeaderboard(req, res);
            return listMarkets(req, res);
        }

        if (req.method === 'POST') {
            const action = req.body?.action;
            if (action === 'create') return createMarket(req, res);
            if (action === 'trade') return trade(req, res);
            if (action === 'resolve') return resolveMarket(req, res);
            if (action === 'dispute') return disputeMarket(req, res);
            if (action === 'faucet') return faucet(req, res);
            return res.status(400).json({ error: 'Unknown action: ' + action });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('OddsClaw API error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
