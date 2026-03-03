// Stripe Webhook Handler
// POST /api/stripe-webhook
// Handles payment confirmation and credits user account

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const credits = parseInt(session.metadata.credits);
        const amount = parseFloat(session.metadata.amount);

        try {
            if (session.metadata.product === 'inclawbate') {
                // ── Inclawbate credit purchase ──
                const handle = session.metadata.handle;
                const profileId = session.metadata.profileId;

                console.log(`Inclawbate payment! Handle: ${handle}, Credits: ${credits}, Amount: $${amount}`);

                const { data: newBalance, error: rpcErr } = await supabase
                    .rpc('add_inclawbate_credits', {
                        target_handle: handle.toLowerCase(),
                        credit_amount: credits
                    });

                if (rpcErr) {
                    console.error('Failed to add Inclawbate credits:', rpcErr);
                    return res.status(200).json({ received: true, warning: 'Credits update failed' });
                }

                // Log to inclawbate_deposits
                await supabase.from('inclawbate_deposits').insert({
                    profile_id: profileId,
                    tx_hash: 'stripe_' + session.id,
                    clawnch_amount: 0,
                    credits_granted: credits
                });

                console.log(`Inclawbate: added ${credits} credits to @${handle} (balance: ${newBalance})`);

            } else {
                // ── Existing SUITE credit purchase ──
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

        } catch (dbError) {
            console.error('Database error:', dbError);
            // Return 200 to prevent Stripe from retrying
            return res.status(200).json({ received: true, warning: 'Database error' });
        }
    }

    return res.status(200).json({ received: true });
}
