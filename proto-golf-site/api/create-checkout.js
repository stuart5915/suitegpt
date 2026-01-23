// Proto Golf - Stripe Checkout API
// Creates a Stripe checkout session for product purchases

import Stripe from 'stripe';

// Product catalog with Stripe price IDs (configure in Stripe Dashboard)
const PRODUCTS = {
    blade: {
        name: 'Proto Golf Blade Putter',
        price: 24900, // cents
        stripePriceId: process.env.STRIPE_PRICE_BLADE
    },
    mallet: {
        name: 'Proto Golf Mallet Putter',
        price: 27900,
        stripePriceId: process.env.STRIPE_PRICE_MALLET
    },
    tour: {
        name: 'Proto Golf Tour Blade',
        price: 34900,
        stripePriceId: process.env.STRIPE_PRICE_TOUR
    },
    classic: {
        name: 'Proto Golf Classic Anser',
        price: 19900,
        stripePriceId: process.env.STRIPE_PRICE_CLASSIC
    },
    proDriver: {
        name: 'Proto Golf Driver X1',
        price: 44900,
        stripePriceId: process.env.STRIPE_PRICE_DRIVER
    },
    headcover: {
        name: 'Proto Golf Headcover',
        price: 3900,
        stripePriceId: process.env.STRIPE_PRICE_HEADCOVER
    },
    grip: {
        name: 'Proto Golf Tour Grip',
        price: 2900,
        stripePriceId: process.env.STRIPE_PRICE_GRIP
    }
};

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
        const { items, success_url, cancel_url } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'No items provided' });
        }

        // Check for Stripe API key
        const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

        if (!STRIPE_SECRET_KEY) {
            console.log('No Stripe API key configured, returning demo mode');
            return res.status(200).json({
                demo: true,
                message: 'Demo mode: Stripe checkout not configured'
            });
        }

        const stripe = new Stripe(STRIPE_SECRET_KEY);

        // Build line items
        const lineItems = items.map(item => {
            const product = PRODUCTS[item.id];

            if (!product) {
                throw new Error(`Unknown product: ${item.id}`);
            }

            // If we have a Stripe price ID, use it
            if (product.stripePriceId) {
                return {
                    price: product.stripePriceId,
                    quantity: 1
                };
            }

            // Otherwise, create ad-hoc price
            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.name,
                        description: formatOptions(item.options),
                        metadata: {
                            product_id: item.id,
                            options: JSON.stringify(item.options || {})
                        }
                    },
                    unit_amount: product.price
                },
                quantity: 1
            };
        });

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: success_url || `${req.headers.origin}/proto-golf-site/shop.html?success=true`,
            cancel_url: cancel_url || `${req.headers.origin}/proto-golf-site/shop.html?cancelled=true`,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA']
            },
            shipping_options: [
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 0, currency: 'usd' },
                        display_name: 'Free Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 5 },
                            maximum: { unit: 'business_day', value: 7 }
                        }
                    }
                },
                {
                    shipping_rate_data: {
                        type: 'fixed_amount',
                        fixed_amount: { amount: 1500, currency: 'usd' },
                        display_name: 'Express Shipping',
                        delivery_estimate: {
                            minimum: { unit: 'business_day', value: 2 },
                            maximum: { unit: 'business_day', value: 3 }
                        }
                    }
                }
            ],
            metadata: {
                source: 'proto_golf_website'
            }
        });

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error('Checkout error:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
}

function formatOptions(options) {
    if (!options || Object.keys(options).length === 0) {
        return undefined;
    }

    return Object.entries(options)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
}
