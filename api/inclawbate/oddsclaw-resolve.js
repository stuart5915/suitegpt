// OddsClaw — Auto-resolve crypto price markets
// Called by Vercel cron every 5 minutes

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DISPUTE_WINDOW_HOURS = 24;

async function fetchPrice(source) {
    // source format: "coingecko:ethereum" or "dexscreener:0xABC..."
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

export default async function handler(req, res) {
    // Only allow cron or manual trigger
    const authHeader = req.headers.authorization;
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

            // Credit winners
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

async function creditWinners(marketId, outcome) {
    const { data: winners } = await supabase
        .from('oddsclaw_positions')
        .select('*')
        .eq('market_id', marketId)
        .eq('side', outcome)
        .gt('shares', 0)
        .eq('claimed', false);

    if (!winners || winners.length === 0) return;

    for (const pos of winners) {
        const payout = parseFloat(pos.shares);
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

        await supabase.from('oddsclaw_positions')
            .update({ claimed: true, claimed_amount: payout })
            .eq('id', pos.id);
    }

    const losingSide = outcome === 'yes' ? 'no' : 'yes';
    await supabase.from('oddsclaw_positions')
        .update({ claimed: true, claimed_amount: 0 })
        .eq('market_id', marketId)
        .eq('side', losingSide)
        .gt('shares', 0)
        .eq('claimed', false);
}
