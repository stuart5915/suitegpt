// OddsClaw — Auto-resolve crypto price markets
// Called by Vercel cron every 5 minutes

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DISPUTE_WINDOW_HOURS = 24;

async function fetchPrice(source) {
    const [provider, id] = (source || '').split(':');

    if (provider === 'dexscreener') {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${id}`);
        if (r.ok) {
            const d = await r.json();
            if (d.pairs && d.pairs.length > 0) {
                return parseFloat(d.pairs[0].priceUsd);
            }
        }
    }

    if (provider === 'coingecko') {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
        if (r.ok) {
            const d = await r.json();
            if (d[id] && d[id].usd) return d[id].usd;
        }
    }

    return null;
}

function compare(price, target, comparator) {
    switch (comparator) {
        case 'gte': return price >= target;
        case 'gt':  return price > target;
        case 'lte': return price <= target;
        case 'lt':  return price < target;
        case 'eq':  return Math.abs(price - target) / Math.max(target, 0.0001) < 0.001; // 0.1% relative
        default: return false;
    }
}

// Distribute pool to winners proportionally (same logic as main API)
async function creditWinners(marketId, outcome) {
    // Re-fetch market for fresh pool values
    const { data: freshMarket } = await supabase
        .from('oddsclaw_markets')
        .select('yes_pool, no_pool, creator_wallet')
        .eq('id', marketId)
        .single();

    if (!freshMarket) return;

    const totalPool = parseFloat(freshMarket.yes_pool) + parseFloat(freshMarket.no_pool);
    if (totalPool <= 0) return;

    const { data: winners } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .eq('side', outcome)
        .gt('shares', 0)
        .eq('claimed', false);

    if (!winners || winners.length === 0) {
        // No winners — return pool to creator
        await supabase.rpc('oddsclaw_credit_wallet', {
            p_wallet: freshMarket.creator_wallet, p_amount: totalPool
        }).catch(() => {});
        return;
    }

    const totalWinningShares = winners.reduce((sum, p) => sum + parseFloat(p.shares), 0);

    for (const pos of winners) {
        const shares = parseFloat(pos.shares);
        const payout = (shares / totalWinningShares) * totalPool;
        const pnl = payout - parseFloat(pos.total_cost);

        await supabase.rpc('oddsclaw_credit_wallet', {
            p_wallet: pos.wallet_address, p_amount: payout
        });

        await supabase.from('oddsclaw_positions')
            .update({ claimed: true, claimed_amount: payout })
            .eq('id', pos.id);

        // Update leaderboard
        await updateLeaderboard(pos.wallet_address, pnl, payout, true);
    }

    // Mark losers + update their leaderboard
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

export default async function handler(req, res) {
    // Verify this is called by Vercel cron or has the correct secret
    const cronSecret = req.headers['x-vercel-cron'];
    const authHeader = req.headers['authorization'];
    const isVercelCron = !!cronSecret;
    const isAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isVercelCron && !isAuthed) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // Find auto-resolve markets past resolution time (active OR closed)
        const { data: markets, error } = await supabase
            .from('oddsclaw_markets')
            .select('*')
            .eq('resolution_type', 'auto_price')
            .in('status', ['active', 'closed'])
            .lte('resolution_time', new Date().toISOString())
            .limit(10);

        if (error || !markets || markets.length === 0) {
            return res.status(200).json({ resolved: 0 });
        }

        let resolved = 0;
        const results = [];

        for (const market of markets) {
            // Guard: skip if resolution_target or comparator is missing
            const target = parseFloat(market.resolution_target);
            if (isNaN(target) || !market.resolution_comparator) {
                results.push({ id: market.id, slug: market.slug, error: 'Missing resolution target or comparator' });
                continue;
            }

            const price = await fetchPrice(market.resolution_source);
            if (price === null) {
                results.push({ id: market.id, slug: market.slug, error: 'Could not fetch price' });
                continue;
            }

            const outcome = compare(price, target, market.resolution_comparator) ? 'yes' : 'no';
            const disputeDeadline = new Date(Date.now() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);

            // Atomically set resolved status (only if still active/closed)
            const { data: updated, error: updateErr } = await supabase.from('oddsclaw_markets')
                .update({
                    resolved_outcome: outcome,
                    resolved_at: new Date().toISOString(),
                    resolved_by: 'auto',
                    dispute_deadline: disputeDeadline.toISOString(),
                    status: 'resolved'
                })
                .eq('id', market.id)
                .in('status', ['active', 'closed'])
                .select('id');

            // If no rows updated, someone else resolved it — skip
            if (updateErr || !updated || updated.length === 0) {
                results.push({ id: market.id, slug: market.slug, error: 'Already resolved or update failed' });
                continue;
            }

            // Distribute pool to winners (re-fetches fresh pool data)
            await creditWinners(market.id, outcome);

            resolved++;
            results.push({ id: market.id, slug: market.slug, outcome, price, target });
        }

        // Also close markets past close_time
        await supabase.from('oddsclaw_markets')
            .update({ status: 'closed' })
            .eq('status', 'active')
            .lte('close_time', new Date().toISOString());

        return res.status(200).json({ resolved, results });
    } catch (err) {
        console.error('OddsClaw resolve error:', err);
        return res.status(500).json({ error: 'Resolve failed' });
    }
}
