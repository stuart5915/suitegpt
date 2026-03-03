// Inclawbate — Stripe Checkout Session Creator
// POST /api/inclawbate/create-checkout
// Body: { credits: number }

import Stripe from 'stripe';
import { authenticateRequest } from './x-callback.js';

const stripe = new Stripe((process.env.INCLAWBATE_STRIPE_SECRET_KEY || '').trim());

const ALLOWED_ORIGINS = [
    'https://inclawbate.com',
    'https://www.inclawbate.com',
];

const PRICE_PER_CREDIT = 0.005; // $0.005 per credit
const MIN_CREDITS = 100;        // $0.50 — Stripe minimum

// Discounted tier bundles (price in cents)
const TIER_PRICING = {
    1500:  600,   // Spark:   $6   (save 20%)
    5000:  1900,  // Builder: $19  (save 24%)
    15000: 5500,  // Studio:  $55  (save 27%)
};

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const user = authenticateRequest(req);
    if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const { credits, return_path } = req.body;

        if (!credits || typeof credits !== 'number' || credits < MIN_CREDITS || credits > 100000) {
            return res.status(400).json({ error: `Credits must be between ${MIN_CREDITS} and 100,000` });
        }

        // Allow caller to specify return page (default: /build)
        const basePath = (return_path && /^\/[a-z]/.test(return_path)) ? return_path : '/build';

        // Use discounted tier price if it matches, otherwise standard rate
        const tierCents = TIER_PRICING[credits];
        const amountCents = tierCents || Math.round(credits * PRICE_PER_CREDIT * 100);
        const amount = amountCents / 100;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: tierCents ? `Inclawbate Credits — ${credits.toLocaleString()} Bundle` : 'Inclawbate Credits',
                            description: `${credits.toLocaleString()} credits for Build Studio`,
                            images: ['https://inclawbate.com/assets/clawsbanner.jpg'],
                        },
                        unit_amount: amountCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `https://inclawbate.com${basePath}?payment=success&credits=${credits}`,
            cancel_url: `https://inclawbate.com${basePath}?payment=cancelled`,
            metadata: {
                product: 'inclawbate',
                profileId: user.sub,
                handle: user.x_handle,
                credits: credits.toString(),
                amount: amount.toString(),
            },
        });

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Inclawbate checkout error:', error);
        return res.status(500).json({ error: 'Failed to create checkout session' });
    }
}
