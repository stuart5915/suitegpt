// Stripe Webhook Handler
// POST /api/stripe-webhook
// Handles payment confirmation and credits user account

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const stripeInclawbate = new Stripe((process.env.INCLAWBATE_STRIPE_SECRET_KEY || '').trim());

// Initialize Supabase with service role key for admin access
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Disable body parsing - Stripe needs raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sig = req.headers['stripe-signature'];
    const secrets = [
        process.env.STRIPE_WEBHOOK_SECRET,
        process.env.INCLAWBATE_STRIPE_WEBHOOK_SECRET,
    ].filter(Boolean);

    let event;

    try {
        const rawBody = await buffer(req);
        // Try each webhook secret — supports multiple Stripe accounts
        for (const secret of secrets) {
            try {
                event = stripe.webhooks.constructEvent(rawBody, sig, secret);
                break;
            } catch (_) { /* try next */ }
        }
        if (!event) throw new Error('No matching webhook secret');
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
        // ── checkout.session.completed ──
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            if (session.metadata.product === 'inclawbate_subscription') {
                // ── New subscription checkout completed ──
                const { tier, credits, profileId, handle } = session.metadata;
                const creditCount = parseInt(credits);

                console.log(`Inclawbate subscription started! Profile: ${profileId}, Tier: ${tier}, Credits: ${creditCount}`);

                // Save subscription info to profile
                const subscriptionId = session.subscription;
                let periodEnd = null;
                if (subscriptionId) {
                    try {
                        const sub = await stripeInclawbate.subscriptions.retrieve(subscriptionId);
                        periodEnd = new Date(sub.current_period_end * 1000).toISOString();
                    } catch (e) {
                        console.error('Failed to retrieve subscription:', e.message);
                    }
                }

                await supabase
                    .from('human_profiles')
                    .update({
                        subscription_tier: tier,
                        subscription_status: 'active',
                        stripe_subscription_id: subscriptionId,
                        subscription_current_period_end: periodEnd,
                    })
                    .eq('id', profileId);

                // Add initial credits
                const { data: newBalance, error: rpcErr } = await supabase
                    .rpc('add_credits_by_id', {
                        target_id: profileId,
                        credit_amount: creditCount
                    });

                if (rpcErr) {
                    console.error('Failed to add subscription credits:', rpcErr);
                } else {
                    console.log(`Subscription: added ${creditCount} credits to profile ${profileId} (balance: ${newBalance})`);
                }

                // Log deposit
                await supabase.from('inclawbate_deposits').insert({
                    profile_id: profileId,
                    tx_hash: 'sub_' + session.id,
                    clawnch_amount: 0,
                    credits_granted: creditCount
                });

            } else if (session.metadata.product === 'inclawbate') {
                // ── Inclawbate one-time credit purchase ──
                const profileId = session.metadata.profileId;
                const credits = parseInt(session.metadata.credits);
                const amount = parseFloat(session.metadata.amount);

                console.log(`Inclawbate payment! Profile: ${profileId}, Credits: ${credits}, Amount: $${amount}`);

                const { data: newBalance, error: rpcErr } = await supabase
                    .rpc('add_credits_by_id', {
                        target_id: profileId,
                        credit_amount: credits
                    });

                if (rpcErr) {
                    console.error('Failed to add Inclawbate credits:', rpcErr);
                    return res.status(200).json({ received: true, warning: 'Credits update failed' });
                }

                await supabase.from('inclawbate_deposits').insert({
                    profile_id: profileId,
                    tx_hash: 'stripe_' + session.id,
                    clawnch_amount: 0,
                    credits_granted: credits
                });

                console.log(`Inclawbate: added ${credits} credits to profile ${profileId} (balance: ${newBalance})`);

            } else {
                // ── Existing SUITE credit purchase ──
                const credits = parseInt(session.metadata.credits);
                const amount = parseFloat(session.metadata.amount);
                const walletAddress = session.metadata.walletAddress;

                console.log(`SUITE payment! Wallet: ${walletAddress}, Credits: ${credits}, Amount: $${amount}`);

                const { data: user, error: userError } = await supabase
                    .from('users')
                    .select('id, credits')
                    .eq('wallet_address', walletAddress.toLowerCase())
                    .single();

                if (userError || !user) {
                    console.error('User not found for wallet:', walletAddress);
                    return res.status(200).json({ received: true, warning: 'User not found' });
                }

                const newCredits = (user.credits || 0) + credits;
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ credits: newCredits })
                    .eq('id', user.id);

                if (updateError) {
                    console.error('Failed to update credits:', updateError);
                    return res.status(200).json({ received: true, warning: 'Credits update failed' });
                }

                await supabase.from('credit_transactions').insert({
                    user_id: user.id,
                    amount: credits,
                    type: 'purchase_fiat',
                    description: `Purchased ${credits} credits via card ($${amount})`,
                    stripe_session_id: session.id,
                });

                console.log(`Successfully added ${credits} credits to user ${user.id}`);
            }
        }

        // ── invoice.payment_succeeded — recurring subscription renewal ──
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object;

            // Only handle renewals — first payment is handled by checkout.session.completed
            if (invoice.billing_reason !== 'subscription_cycle') {
                return res.status(200).json({ received: true });
            }

            const subscriptionId = invoice.subscription;
            if (!subscriptionId) return res.status(200).json({ received: true });

            // Get subscription metadata
            let sub;
            try {
                sub = await stripeInclawbate.subscriptions.retrieve(subscriptionId);
            } catch (e) {
                console.error('Failed to retrieve subscription for renewal:', e.message);
                return res.status(200).json({ received: true, warning: 'Could not retrieve subscription' });
            }

            const meta = sub.metadata || {};
            if (meta.product !== 'inclawbate_subscription') {
                return res.status(200).json({ received: true });
            }

            const { tier, credits, profileId } = meta;
            const creditCount = parseInt(credits);

            console.log(`Subscription renewal! Profile: ${profileId}, Tier: ${tier}, Credits: ${creditCount}`);

            // Add monthly credits
            const { data: newBalance, error: rpcErr } = await supabase
                .rpc('add_credits_by_id', {
                    target_id: profileId,
                    credit_amount: creditCount
                });

            if (rpcErr) {
                console.error('Failed to add renewal credits:', rpcErr);
            } else {
                console.log(`Renewal: added ${creditCount} credits to profile ${profileId} (balance: ${newBalance})`);
            }

            // Update period end
            const periodEnd = sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null;

            await supabase
                .from('human_profiles')
                .update({ subscription_current_period_end: periodEnd })
                .eq('id', profileId);

            // Log deposit
            await supabase.from('inclawbate_deposits').insert({
                profile_id: profileId,
                tx_hash: 'renewal_' + invoice.id,
                clawnch_amount: 0,
                credits_granted: creditCount
            });
        }

        // ── customer.subscription.updated ──
        if (event.type === 'customer.subscription.updated') {
            const sub = event.data.object;
            const meta = sub.metadata || {};
            if (meta.product !== 'inclawbate_subscription' || !meta.profileId) {
                return res.status(200).json({ received: true });
            }

            const status = sub.cancel_at_period_end ? 'canceled' :
                           sub.status === 'active' ? 'active' :
                           sub.status === 'past_due' ? 'past_due' : sub.status;

            const periodEnd = sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null;

            await supabase
                .from('human_profiles')
                .update({
                    subscription_status: status,
                    subscription_tier: meta.tier || null,
                    subscription_current_period_end: periodEnd,
                })
                .eq('id', meta.profileId);

            console.log(`Subscription updated for profile ${meta.profileId}: status=${status}, tier=${meta.tier}`);
        }

        // ── customer.subscription.deleted ──
        if (event.type === 'customer.subscription.deleted') {
            const sub = event.data.object;
            const meta = sub.metadata || {};
            if (meta.product !== 'inclawbate_subscription' || !meta.profileId) {
                return res.status(200).json({ received: true });
            }

            await supabase
                .from('human_profiles')
                .update({
                    subscription_status: 'none',
                    subscription_tier: null,
                    stripe_subscription_id: null,
                    subscription_current_period_end: null,
                })
                .eq('id', meta.profileId);

            console.log(`Subscription deleted for profile ${meta.profileId}`);
        }

    } catch (dbError) {
        console.error('Database error:', dbError);
        return res.status(200).json({ received: true, warning: 'Database error' });
    }

    return res.status(200).json({ received: true });
}
