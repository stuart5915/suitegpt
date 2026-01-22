// Stripe Checkout Session Creator
// POST /api/create-checkout
// Body: { amount: number, walletAddress: string }

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { amount, walletAddress } = req.body;

        // Validate inputs
        if (!amount || amount < 1 || amount > 1000) {
            return res.status(400).json({ error: 'Amount must be between $1 and $1000' });
        }

        if (!walletAddress || !walletAddress.startsWith('0x')) {
            return res.status(400).json({ error: 'Valid wallet address required' });
        }

        const credits = amount * 1000;

        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'SUITE Credits',
                            description: `${credits.toLocaleString()} credits for SUITE apps`,
                            images: ['https://getsuite.app/assets/suite-logo-new.png'],
                        },
                        unit_amount: amount * 100, // Stripe uses cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.SITE_URL || 'https://getsuite.app'}/profile.html?payment=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL || 'https://getsuite.app'}/profile.html?payment=cancelled`,
            metadata: {
                walletAddress: walletAddress,
                credits: credits.toString(),
                amount: amount.toString(),
            },
        });

        return res.status(200).json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Stripe checkout error:', error);
        return res.status(500).json({ error: 'Failed to create checkout session' });
    }
}
