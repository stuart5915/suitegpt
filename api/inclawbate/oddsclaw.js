// OddsClaw — Prediction Market API
// GET: list markets, market detail, positions, leaderboard
// POST: create market, trade, resolve, claim, dispute

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://oddsclaw.app',
    'https://www.oddsclaw.app',
    'http://localhost:3000'
];

const TRADING_FEE = 0.02; // 2%
const MARKET_CREATION_COST = 100; // ODDS burned to create
const MIN_INITIAL_LIQUIDITY = 200; // minimum ODDS to seed pool
const DISPUTE_STAKE = 500; // ODDS to file a dispute
const DISPUTE_WINDOW_HOURS = 24;

// Slug generator
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
// AMM Math (constant product: x * y = k)
// ──────────────────────────────────────────────
function calcBuyShares(yesPool, noPool, side, oddsAmount) {
    const fee = oddsAmount * TRADING_FEE;
    const net = oddsAmount - fee;
    if (net <= 0) return { shares: 0, fee, price: 0 };

    let shares;
    if (side === 'yes') {
        // Buy YES: add ODDS to NO pool, take shares from YES pool
        shares = yesPool - (yesPool * noPool) / (noPool + net);
        if (shares >= yesPool) shares = yesPool * 0.99; // cap at 99% of pool
    } else {
        shares = noPool - (yesPool * noPool) / (yesPool + net);
        if (shares >= noPool) shares = noPool * 0.99;
    }
    const price = shares > 0 ? net / shares : 0;
    return { shares: Math.max(0, shares), fee, price };
}

function calcSellPayout(yesPool, noPool, side, shares) {
    let oddsOut;
    if (side === 'yes') {
        oddsOut = noPool - (yesPool * noPool) / (yesPool + shares);
        if (oddsOut >= noPool) oddsOut = noPool * 0.99;
    } else {
        oddsOut = yesPool - (yesPool * noPool) / (noPool + shares);
        if (oddsOut >= yesPool) oddsOut = yesPool * 0.99;
    }
    const fee = oddsOut * TRADING_FEE;
    const netPayout = oddsOut - fee;
    return { payout: Math.max(0, netPayout), fee, grossPayout: oddsOut };
}

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

    // Get recent trades
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
    const { data, error } = await supabase
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

    // Check balance
    const { data: walletData } = await supabase
        .from('oddsclaw_wallets')
        .select('odds_balance')
        .eq('wallet_address', w)
        .single();

    const balance = walletData ? parseFloat(walletData.odds_balance) : 0;
    if (balance < totalCost) {
        return res.status(400).json({ error: `Need ${totalCost} ODDS (${MARKET_CREATION_COST} creation fee + ${liquidity} liquidity). You have ${balance.toFixed(2)}` });
    }

    // Generate unique slug
    let slug = slugify(question);
    const { data: existing } = await supabase.from('oddsclaw_markets').select('slug').eq('slug', slug).single();
    if (existing) slug = slug + '-' + Date.now().toString(36);

    const halfLiquidity = liquidity / 2;

    // Debit wallet
    const { error: debitErr } = await supabase
        .from('oddsclaw_wallets')
        .update({ odds_balance: balance - totalCost })
        .eq('wallet_address', w);

    if (debitErr) return res.status(500).json({ error: 'Failed to debit wallet' });

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
        await supabase.from('oddsclaw_wallets').update({ odds_balance: balance }).eq('wallet_address', w);
        console.error('Market creation error:', createErr);
        return res.status(500).json({ error: 'Failed to create market' });
    }

    // Update leaderboard
    await supabase.rpc('increment_oddsclaw_leaderboard', { p_wallet: w, p_field: 'markets_created', p_amount: 1 }).catch(() => {});

    market.probs = getProbs(halfLiquidity, halfLiquidity);
    return res.status(200).json({ success: true, market });
}

async function trade(req, res) {
    const { wallet, market_id, side, odds_amount: rawAmount, direction } = req.body;

    const w = (wallet || '').toLowerCase();
    if (!w) return res.status(400).json({ error: 'Wallet required' });
    if (!market_id) return res.status(400).json({ error: 'Market ID required' });
    if (!side || !['yes', 'no'].includes(side)) return res.status(400).json({ error: 'Side must be yes or no' });

    const dir = direction || 'buy';
    const amount = parseFloat(rawAmount);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    // Get market
    const { data: market, error: mErr } = await supabase
        .from('oddsclaw_markets')
        .select('*')
        .eq('id', market_id)
        .single();

    if (mErr || !market) return res.status(404).json({ error: 'Market not found' });
    if (market.status !== 'active') return res.status(400).json({ error: 'Market is not active' });
    if (new Date(market.close_time) <= new Date()) return res.status(400).json({ error: 'Market is closed for trading' });

    let yesPool = parseFloat(market.yes_pool);
    let noPool = parseFloat(market.no_pool);

    if (dir === 'buy') {
        // Check balance
        const { data: walletData } = await supabase
            .from('oddsclaw_wallets')
            .select('odds_balance')
            .eq('wallet_address', w)
            .single();

        const balance = walletData ? parseFloat(walletData.odds_balance) : 0;
        if (balance < amount) return res.status(400).json({ error: `Insufficient balance. Have ${balance.toFixed(2)}, need ${amount}` });

        const { shares, fee, price } = calcBuyShares(yesPool, noPool, side, amount);
        if (shares <= 0) return res.status(400).json({ error: 'Trade too small' });

        // Update pools
        if (side === 'yes') {
            noPool += (amount - fee);
            yesPool -= shares;
        } else {
            yesPool += (amount - fee);
            noPool -= shares;
        }

        // Debit wallet
        await supabase.from('oddsclaw_wallets')
            .update({ odds_balance: balance - amount })
            .eq('wallet_address', w);

        // Upsert position
        const { data: existingPos } = await supabase
            .from('oddsclaw_positions')
            .select('*')
            .eq('market_id', market_id)
            .eq('wallet_address', w)
            .eq('side', side)
            .single();

        if (existingPos) {
            const newShares = parseFloat(existingPos.shares) + shares;
            const newCost = parseFloat(existingPos.total_cost) + amount;
            const newAvg = newCost / newShares;
            await supabase.from('oddsclaw_positions')
                .update({ shares: newShares, total_cost: newCost, avg_price: newAvg })
                .eq('id', existingPos.id);
        } else {
            await supabase.from('oddsclaw_positions')
                .insert({ market_id, wallet_address: w, side, shares, avg_price: price, total_cost: amount });
        }

        // Update market
        await supabase.from('oddsclaw_markets')
            .update({
                yes_pool: yesPool,
                no_pool: noPool,
                total_volume: parseFloat(market.total_volume) + amount,
                trade_count: (market.trade_count || 0) + 1
            })
            .eq('id', market_id);

        // Record trade
        await supabase.from('oddsclaw_trades')
            .insert({
                market_id, wallet_address: w, side, direction: 'buy',
                shares, price, odds_amount: amount, fee_odds: fee,
                yes_pool_after: yesPool, no_pool_after: noPool
            });

        return res.status(200).json({
            success: true,
            shares: parseFloat(shares.toFixed(4)),
            price: parseFloat(price.toFixed(6)),
            fee: parseFloat(fee.toFixed(4)),
            new_probs: getProbs(yesPool, noPool)
        });

    } else if (dir === 'sell') {
        // Sell shares
        const { data: pos } = await supabase
            .from('oddsclaw_positions')
            .select('*')
            .eq('market_id', market_id)
            .eq('wallet_address', w)
            .eq('side', side)
            .single();

        if (!pos || parseFloat(pos.shares) < amount) {
            return res.status(400).json({ error: `Insufficient shares. Have ${pos ? parseFloat(pos.shares).toFixed(4) : 0}` });
        }

        const { payout, fee, grossPayout } = calcSellPayout(yesPool, noPool, side, amount);

        // Update pools
        if (side === 'yes') {
            yesPool += amount;
            noPool -= grossPayout;
        } else {
            noPool += amount;
            yesPool -= grossPayout;
        }

        // Credit wallet
        const { data: walletData } = await supabase
            .from('oddsclaw_wallets')
            .select('odds_balance')
            .eq('wallet_address', w)
            .single();

        const balance = walletData ? parseFloat(walletData.odds_balance) : 0;
        await supabase.from('oddsclaw_wallets')
            .update({ odds_balance: balance + payout })
            .eq('wallet_address', w);

        // Update position
        const newShares = parseFloat(pos.shares) - amount;
        const realizedPnl = payout - (parseFloat(pos.avg_price) * amount);
        await supabase.from('oddsclaw_positions')
            .update({
                shares: newShares,
                realized_pnl: parseFloat(pos.realized_pnl) + realizedPnl
            })
            .eq('id', pos.id);

        // Update market
        await supabase.from('oddsclaw_markets')
            .update({
                yes_pool: yesPool,
                no_pool: noPool,
                total_volume: parseFloat(market.total_volume) + payout,
                trade_count: (market.trade_count || 0) + 1
            })
            .eq('id', market_id);

        // Record trade
        await supabase.from('oddsclaw_trades')
            .insert({
                market_id, wallet_address: w, side, direction: 'sell',
                shares: amount, price: payout / amount, odds_amount: payout, fee_odds: fee,
                yes_pool_after: yesPool, no_pool_after: noPool
            });

        return res.status(200).json({
            success: true,
            payout: parseFloat(payout.toFixed(4)),
            fee: parseFloat(fee.toFixed(4)),
            new_probs: getProbs(yesPool, noPool)
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

    await supabase.from('oddsclaw_markets')
        .update({
            resolved_outcome: outcome,
            resolved_at: now.toISOString(),
            resolved_by: w,
            dispute_deadline: disputeDeadline.toISOString(),
            status: 'resolved'
        })
        .eq('id', market_id);

    // Credit winners
    if (outcome !== 'void') {
        await creditWinners(market_id, outcome);
    } else {
        await refundAll(market_id);
    }

    return res.status(200).json({ success: true, outcome, dispute_deadline: disputeDeadline.toISOString() });
}

async function creditWinners(marketId, outcome) {
    // Get all positions on winning side
    const { data: winners } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .eq('side', outcome)
        .gt('shares', 0)
        .eq('claimed', false);

    if (!winners || winners.length === 0) return;

    for (const pos of winners) {
        const payout = parseFloat(pos.shares); // 1 share = 1 ODDS on win
        // Credit wallet
        const { data: walletData } = await supabase
            .from('oddsclaw_wallets')
            .select('odds_balance')
            .eq('wallet_address', pos.wallet_address)
            .single();

        const balance = walletData ? parseFloat(walletData.odds_balance) : 0;

        if (walletData) {
            await supabase.from('oddsclaw_wallets')
                .update({ odds_balance: balance + payout })
                .eq('wallet_address', pos.wallet_address);
        } else {
            await supabase.from('oddsclaw_wallets')
                .insert({ wallet_address: pos.wallet_address, odds_balance: payout });
        }

        // Mark claimed
        await supabase.from('oddsclaw_positions')
            .update({ claimed: true, claimed_amount: payout })
            .eq('id', pos.id);

        // Update leaderboard
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
    const { data: positions } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .gt('shares', 0)
        .eq('claimed', false);

    if (!positions) return;

    for (const pos of positions) {
        const refund = parseFloat(pos.total_cost);
        const { data: walletData } = await supabase
            .from('oddsclaw_wallets')
            .select('odds_balance')
            .eq('wallet_address', pos.wallet_address)
            .single();

        const balance = walletData ? parseFloat(walletData.odds_balance) : 0;
        if (walletData) {
            await supabase.from('oddsclaw_wallets')
                .update({ odds_balance: balance + refund })
                .eq('wallet_address', pos.wallet_address);
        } else {
            await supabase.from('oddsclaw_wallets')
                .insert({ wallet_address: pos.wallet_address, odds_balance: refund });
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

    // Check balance for stake
    const { data: walletData } = await supabase
        .from('oddsclaw_wallets')
        .select('odds_balance')
        .eq('wallet_address', w)
        .single();

    const balance = walletData ? parseFloat(walletData.odds_balance) : 0;
    if (balance < DISPUTE_STAKE) return res.status(400).json({ error: `Need ${DISPUTE_STAKE} ODDS to dispute. Have ${balance.toFixed(2)}` });

    // Debit stake
    await supabase.from('oddsclaw_wallets')
        .update({ odds_balance: balance - DISPUTE_STAKE })
        .eq('wallet_address', w);

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
        await supabase.from('oddsclaw_wallets').update({ odds_balance: balance }).eq('wallet_address', w);
        return res.status(500).json({ error: 'Failed to create dispute' });
    }

    // Mark market as disputed
    await supabase.from('oddsclaw_markets').update({ status: 'disputed' }).eq('id', market_id);

    return res.status(200).json({ success: true, dispute });
}

// ──────────────────────────────────────────────
// Give test balance (for testing before token launch)
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
        if (bal >= 1000) return res.status(400).json({ error: 'You already have enough test ODDS' });
        await supabase.from('oddsclaw_wallets')
            .update({ odds_balance: bal + 10000 })
            .eq('wallet_address', w);
    } else {
        await supabase.from('oddsclaw_wallets')
            .insert({ wallet_address: w, odds_balance: 10000 });
    }

    return res.status(200).json({ success: true, balance: existing ? parseFloat(existing.odds_balance) + 10000 : 10000 });
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
