// MoveStrong - Stripe Checkout API
// Creates a Stripe checkout session for program subscriptions and one-time purchases

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Product catalog with Stripe price IDs
const PRODUCTS = {
    // Monthly subscriptions
    'starter': {
        name: 'Starter Package',
        priceId: process.env.STRIPE_PRICE_STARTER || 'price_starter_monthly',
        mode: 'subscription'
    },
    'pro': {
        name: 'Pro Package',
        priceId: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
        mode: 'subscription'
    },
    'elite': {
        name: 'Elite Package',
        priceId: process.env.STRIPE_PRICE_ELITE || 'price_elite_monthly',
        mode: 'subscription'
    },
    // One-time purchases
    'workout-plan': {
        name: '8-Week Custom Workout Plan',
        priceId: process.env.STRIPE_PRICE_WORKOUT || 'price_workout_plan',
        mode: 'payment'
    },
    'nutrition-guide': {
        name: 'Nutrition Guide + Meal Plan',
        priceId: process.env.STRIPE_PRICE_NUTRITION || 'price_nutrition',
        mode: 'payment'
    },
    'consultation': {
        name: '1-on-1 Consultation (60 min)',
        priceId: process.env.STRIPE_PRICE_CONSULTATION || 'price_consultation',
        mode: 'payment'
    },
    'home-gym': {
        name: 'Home Gym Setup Guide',
        priceId: process.env.STRIPE_PRICE_HOME_GYM || 'price_home_gym',
        mode: 'payment'
    }
};

module.exports = async (req, res) => {
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
        const { productId, successUrl, cancelUrl, customerEmail } = req.body;

        // Validate product
        const product = PRODUCTS[productId];
        if (!product) {
            return res.status(400).json({ error: 'Invalid product ID' });
        }

        // Check for Stripe key
        if (!process.env.STRIPE_SECRET_KEY) {
            console.log('Stripe not configured, returning demo URL');
            return res.json({
                url: successUrl || '/movestrong/clients.html?success=true',
                demo: true
            });
        }

        // Create checkout session
        const sessionConfig = {
            payment_method_types: ['card'],
            line_items: [{
                price: product.priceId,
                quantity: 1
            }],
            mode: product.mode,
            success_url: successUrl || `${process.env.SITE_URL || 'https://movestrong.fit'}/clients.html?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl || `${process.env.SITE_URL || 'https://movestrong.fit'}/programs.html`,
            metadata: {
                product_id: productId,
                product_name: product.name,
                source: 'movestrong'
            },
            allow_promotion_codes: true,
            billing_address_collection: 'auto'
        };

        // Add customer email if provided
        if (customerEmail) {
            sessionConfig.customer_email = customerEmail;
        }

        // Add trial period for subscriptions
        if (product.mode === 'subscription') {
            sessionConfig.subscription_data = {
                trial_period_days: 7, // 7-day free trial
                metadata: {
                    product_id: productId
                }
            };
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return res.json({ url: session.url });

    } catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
};
