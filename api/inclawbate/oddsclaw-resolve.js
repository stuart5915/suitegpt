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
        case 'eq':  return Math.abs(price - target) < 0.01;
        default: return false;
    }
}

// Distribute pool to winners proportionally (same logic as main API)
async function creditWinners(marketId, outcome, market) {
    const totalPool = parseFloat(market.yes_pool) + parseFloat(market.no_pool);
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
            p_wallet: market.creator_wallet, p_amount: totalPool
        }).catch(() => {});
        return;
    }

    const totalWinningShares = winners.reduce((sum, p) => sum + parseFloat(p.shares), 0);

    for (const pos of winners) {
        const shares = parseFloat(pos.shares);
        const payout = (shares / totalWinningShares) * totalPool;

        await supabase.rpc('oddsclaw_credit_wallet', {
            p_wallet: pos.wallet_address, p_amount: payout
        });

        await supabase.from('oddsclaw_positions')
            .update({ claimed: true, claimed_amount: payout })
            .eq('id', pos.id);
    }

    // Mark losers
    const losingSide = outcome === 'yes' ? 'no' : 'yes';
    await supabase.from('oddsclaw_positions')
        .update({ claimed: true, claimed_amount: 0 })
        .eq('market_id', marketId)
        .eq('side', losingSide)
        .gt('shares', 0)
        .eq('claimed', false);
}

export default async function handler(req, res) {
    const cronSecret = req.headers['x-vercel-cron'];

    try {
        // Find auto-resolve markets past resolution time
        const { data: markets, error } = await supabase
            .from('oddsclaw_markets')
            .select('*')
            .eq('resolution_type', 'auto_price')
            .eq('status', 'active')
            .lte('resolution_time', new Date().toISOString())
            .limit(10);

        if (error || !markets || markets.length === 0) {
            return res.status(200).json({ resolved: 0 });
        }

        let resolved = 0;
        const results = [];

        for (const market of markets) {
            const price = await fetchPrice(market.resolution_source);
            if (price === null) {
                results.push({ id: market.id, slug: market.slug, error: 'Could not fetch price' });
                continue;
            }

            const target = parseFloat(market.resolution_target);
            const outcome = compare(price, target, market.resolution_comparator) ? 'yes' : 'no';
            const disputeDeadline = new Date(Date.now() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);

            await supabase.from('oddsclaw_markets')
                .update({
                    resolved_outcome: outcome,
                    resolved_at: new Date().toISOString(),
                    resolved_by: 'auto',
                    dispute_deadline: disputeDeadline.toISOString(),
                    status: 'resolved'
                })
                .eq('id', market.id);

            // Distribute pool to winners
            await creditWinners(market.id, outcome, market);

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
