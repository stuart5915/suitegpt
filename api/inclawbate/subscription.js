// Inclawbate — Subscription Management
// GET  /api/inclawbate/subscription  → current subscription status
// POST /api/inclawbate/subscription  → create | cancel | change | reactivate

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from './x-callback.js';

const stripe = new Stripe((process.env.INCLAWBATE_STRIPE_SECRET_KEY || '').trim());

const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
    'https://inclawbate.app',
    'https://www.inclawbate.app',
];

const TIERS = {
    spark:   { credits: 1500,  cents: 600,  label: 'Spark'   },
    builder: { credits: 5000,  cents: 1900, label: 'Builder' },
    studio:  { credits: 15000, cents: 5500, label: 'Studio'  },
};

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    // ── GET: return subscription status ──
    if (req.method === 'GET') {
        try {
            const { data: profile, error } = await supabase
                .from('human_profiles')
                .select('subscription_tier, subscription_status, stripe_subscription_id, subscription_current_period_end')
                .eq('id', user.sub)
                .single();

            if (error) return res.status(500).json({ error: 'Failed to load profile' });

            return res.status(200).json({
                tier: profile.subscription_tier || null,
                status: profile.subscription_status || 'none',
                subscription_id: profile.stripe_subscription_id || null,
                current_period_end: profile.subscription_current_period_end || null,
            });
        } catch (e) {
            return res.status(500).json({ error: 'Internal error' });
        }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { action, tier } = req.body;

    // ── POST action:"create" — start a new subscription checkout ──
    if (action === 'create') {
        if (!tier || !TIERS[tier]) return res.status(400).json({ error: 'Invalid tier' });
        const t = TIERS[tier];

        try {
            // Get or create Stripe customer
            let { data: profile } = await supabase
                .from('human_profiles')
                .select('stripe_customer_id, x_handle, subscription_status')
                .eq('id', user.sub)
                .single();

            if (profile?.subscription_status === 'active') {
                return res.status(400).json({ error: 'You already have an active subscription. Use "change" to switch tiers.' });
            }

            let customerId = profile?.stripe_customer_id;
            if (!customerId) {
                const customer = await stripe.customers.create({
                    metadata: { profileId: user.sub, handle: user.x_handle },
                });
                customerId = customer.id;
                await supabase
                    .from('human_profiles')
                    .update({ stripe_customer_id: customerId })
                    .eq('id', user.sub);
            }

            // Get or create price via lookup_key
            const lookupKey = `inclawbate_${tier}_monthly`;
            const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
            let priceId;

            if (existing.data.length > 0) {
                priceId = existing.data[0].id;
            } else {
                const price = await stripe.prices.create({
                    currency: 'usd',
                    unit_amount: t.cents,
                    recurring: { interval: 'month' },
                    product_data: {
                        name: `Inclawbate ${t.label} — Monthly`,
                        metadata: { tier },
                    },
                    lookup_key: lookupKey,
                });
                priceId = price.id;
            }

            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'subscription',
                success_url: `https://inclawbate.app/dashboard?subscription=success`,
                cancel_url: `https://inclawbate.app/dashboard?subscription=cancelled`,
                metadata: {
                    product: 'inclawbate_subscription',
                    tier,
                    credits: t.credits.toString(),
                    profileId: user.sub,
                    handle: user.x_handle,
                },
                subscription_data: {
                    metadata: {
                        product: 'inclawbate_subscription',
                        tier,
                        credits: t.credits.toString(),
                        profileId: user.sub,
                        handle: user.x_handle,
                    },
                },
            });

            return res.status(200).json({ url: session.url });
        } catch (e) {
            console.error('Subscription create error:', e);
            return res.status(500).json({ error: 'Failed to create subscription checkout' });
        }
    }

    // ── POST action:"cancel" — cancel at period end ──
    if (action === 'cancel') {
        try {
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('stripe_subscription_id')
                .eq('id', user.sub)
                .single();

            if (!profile?.stripe_subscription_id) {
                return res.status(400).json({ error: 'No active subscription' });
            }

            await stripe.subscriptions.update(profile.stripe_subscription_id, {
                cancel_at_period_end: true,
            });

            await supabase
                .from('human_profiles')
                .update({ subscription_status: 'canceled' })
                .eq('id', user.sub);

            return res.status(200).json({ ok: true, status: 'canceled' });
        } catch (e) {
            console.error('Subscription cancel error:', e);
            return res.status(500).json({ error: 'Failed to cancel subscription' });
        }
    }

    // ── POST action:"reactivate" — un-cancel ──
    if (action === 'reactivate') {
        try {
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('stripe_subscription_id')
                .eq('id', user.sub)
                .single();

            if (!profile?.stripe_subscription_id) {
                return res.status(400).json({ error: 'No subscription to reactivate' });
            }

            await stripe.subscriptions.update(profile.stripe_subscription_id, {
                cancel_at_period_end: false,
            });

            await supabase
                .from('human_profiles')
                .update({ subscription_status: 'active' })
                .eq('id', user.sub);

            return res.status(200).json({ ok: true, status: 'active' });
        } catch (e) {
            console.error('Subscription reactivate error:', e);
            return res.status(500).json({ error: 'Failed to reactivate subscription' });
        }
    }

    // ── POST action:"change" — upgrade/downgrade ──
    if (action === 'change') {
        if (!tier || !TIERS[tier]) return res.status(400).json({ error: 'Invalid tier' });
        const t = TIERS[tier];

        try {
            const { data: profile } = await supabase
                .from('human_profiles')
                .select('stripe_subscription_id, subscription_tier')
                .eq('id', user.sub)
                .single();

            if (!profile?.stripe_subscription_id) {
                return res.status(400).json({ error: 'No active subscription to change' });
            }

            if (profile.subscription_tier === tier) {
                return res.status(400).json({ error: 'Already on this tier' });
            }

            // Get price for new tier
            const lookupKey = `inclawbate_${tier}_monthly`;
            const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
            let priceId;

            if (existing.data.length > 0) {
                priceId = existing.data[0].id;
            } else {
                const price = await stripe.prices.create({
                    currency: 'usd',
                    unit_amount: t.cents,
                    recurring: { interval: 'month' },
                    product_data: {
                        name: `Inclawbate ${t.label} — Monthly`,
                        metadata: { tier },
                    },
                    lookup_key: lookupKey,
                });
                priceId = price.id;
            }

            const subscription = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
            await stripe.subscriptions.update(profile.stripe_subscription_id, {
                items: [{
                    id: subscription.items.data[0].id,
                    price: priceId,
                }],
                proration_behavior: 'create_prorations',
                metadata: {
                    product: 'inclawbate_subscription',
                    tier,
                    credits: t.credits.toString(),
                    profileId: user.sub,
                    handle: user.x_handle,
                },
            });

            // Update local record immediately
            await supabase
                .from('human_profiles')
                .update({ subscription_tier: tier })
                .eq('id', user.sub);

            return res.status(200).json({ ok: true, tier });
        } catch (e) {
            console.error('Subscription change error:', e);
            return res.status(500).json({ error: 'Failed to change subscription' });
        }
    }

    return res.status(400).json({ error: 'Unknown action' });
}
