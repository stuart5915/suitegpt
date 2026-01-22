// Proto Golf Stripe Checkout Session Creator
// POST /api/create-proto-checkout
// Body: { items: [{name, price}], total: number, shipping: {name, email, address, city, state, zip} }

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
        const { items, total, shipping } = req.body;

        // Validate inputs
        if (!items || !items.length) {
            return res.status(400).json({ error: 'No items in cart' });
        }

        if (!shipping || !shipping.name || !shipping.email || !shipping.address) {
            return res.status(400).json({ error: 'Shipping info required' });
        }

        // Create line items for Stripe
        const lineItems = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name,
                    description: 'Proto Golf Equipment',
                    images: ['https://getsuite.app/assets/suite-logo-new.png'],
                },
                unit_amount: Math.round(item.price * 100), // Stripe uses cents
            },
            quantity: 1,
        }));

        // Create Stripe Checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.SITE_URL || 'https://getsuite.app'}/proto-golf.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL || 'https://getsuite.app'}/proto-golf.html?cancelled=true`,
            customer_email: shipping.email,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'AU'],
            },
            metadata: {
                customerName: shipping.name,
                customerEmail: shipping.email,
                shippingAddress: `${shipping.address}, ${shipping.city}, ${shipping.state} ${shipping.zip}`,
                items: items.map(i => i.name).join(', '),
                source: 'proto-golf'
            },
        });

        return res.status(200).json({
            sessionId: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Proto Golf checkout error:', error);

        // If Stripe fails, return demo mode flag
        if (error.type === 'StripeAuthenticationError' || !process.env.STRIPE_SECRET_KEY) {
            return res.status(200).json({ demo: true, message: 'Demo mode - Stripe not configured' });
        }

        return res.status(500).json({ error: 'Failed to create checkout session' });
    }
}
