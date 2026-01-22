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
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        const rawBody = await buffer(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        // Extract metadata
        const walletAddress = session.metadata.walletAddress;
        const credits = parseInt(session.metadata.credits);
        const amount = parseFloat(session.metadata.amount);

        console.log(`Payment successful! Wallet: ${walletAddress}, Credits: ${credits}, Amount: $${amount}`);

        try {
            // Find user by wallet address
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, credits')
                .eq('wallet_address', walletAddress.toLowerCase())
                .single();

            if (userError || !user) {
                console.error('User not found for wallet:', walletAddress);
                // Still return 200 to Stripe - we'll handle manually
                return res.status(200).json({ received: true, warning: 'User not found' });
            }

            // Add credits to user
            const newCredits = (user.credits || 0) + credits;
            const { error: updateError } = await supabase
                .from('users')
                .update({ credits: newCredits })
                .eq('id', user.id);

            if (updateError) {
                console.error('Failed to update credits:', updateError);
                return res.status(200).json({ received: true, warning: 'Credits update failed' });
            }

            // Log the transaction
            await supabase.from('credit_transactions').insert({
                user_id: user.id,
                amount: credits,
                type: 'purchase_fiat',
                description: `Purchased ${credits} credits via card ($${amount})`,
                stripe_session_id: session.id,
            });

            console.log(`Successfully added ${credits} credits to user ${user.id}`);

        } catch (dbError) {
            console.error('Database error:', dbError);
            // Return 200 to prevent Stripe from retrying
            return res.status(200).json({ received: true, warning: 'Database error' });
        }
    }

    return res.status(200).json({ received: true });
}
