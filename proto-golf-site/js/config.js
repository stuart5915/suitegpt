// Proto Golf Configuration
// Replace these with your actual keys when ready

const CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://rdsmdywbdiskxknluiym.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkc21keXdiZGlza3hrbmx1aXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3ODk3MTgsImV4cCI6MjA4MzM2NTcxOH0.DcLpWs8Lf1s4Flf54J5LubokSYrd7h-XvI_X0jj6bLM',

    // Stripe - Create account at stripe.com
    // Use test keys (pk_test_...) for development
    STRIPE_PUBLISHABLE_KEY: 'YOUR_STRIPE_PUBLISHABLE_KEY',

    // Business Info
    BUSINESS_EMAIL: 'hello@protogolf.com',
    BUSINESS_PHONE: '519-212-8762',
    BUSINESS_ADDRESS: {
        name: 'Proto Golf / Telos Manufacturing',
        line1: '1721 Bishop Street North Unit 4',
        city: 'Cambridge',
        state: 'ON',
        postal_code: 'N1T 1N5',
        country: 'CA'
    },

    // Shipping
    SHIPPING_RATE: 25, // Flat rate in CAD
    SHIPPING_DAYS: '5-7 business days',

    // Pickup
    PICKUP_DAYS: '5-7 business days',
    PICKUP_HOURS: ['10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'],

    // Inventory threshold - show "Sold Out" when stock reaches this
    LOW_STOCK_THRESHOLD: 1
};

// Product catalog with base prices
const PRODUCTS = {
    'rough-mill': {
        id: 'rough-mill',
        name: 'Rough Mill',
        basePrice: 399,
        material: '304 Stainless Steel',
        finishes: {
            'raw': { name: 'Raw', priceAdd: 0 },
            'brushed': { name: 'Brushed', priceAdd: 25 },
            'black-dlc': { name: 'Black DLC', priceAdd: 75 },
            'chrome': { name: 'Chrome', priceAdd: 50 }
        },
        shaftColors: {
            'chrome': { name: 'Chrome', priceAdd: 0 },
            'black': { name: 'Black', priceAdd: 15 }
        },
        specs: {
            headWeight: '370g',
            shaftWeight: '110g chrome steel',
            lie: '72°',
            loft: '3°',
            length: '35"',
            grip: 'SuperStroke Pistol 2.0'
        }
    },
    'centre-blade': {
        id: 'centre-blade',
        name: 'Centre Blade',
        basePrice: 449,
        material: '1045 Carbon Steel',
        finishes: {
            'gun-blue': { name: 'Gun Blue', priceAdd: 0 }
        },
        shaftColors: {
            'black': { name: 'Black', priceAdd: 0 }
        },
        specs: {
            headWeight: '360g',
            shaftWeight: '110g chrome steel',
            lie: '71°',
            loft: '3°',
            length: '35"',
            grip: 'SuperStroke Pistol 2.0 (all black)',
            feature: 'Zero torque design',
            paintFill: 'White sight line'
        }
    },
    'long-neck-blade': {
        id: 'long-neck-blade',
        name: 'Long Neck Blade',
        basePrice: 429,
        material: '304 Stainless Steel',
        finishes: {
            'raw': { name: 'Raw', priceAdd: 0 },
            'brushed': { name: 'Brushed', priceAdd: 25 }
        },
        shaftColors: {
            'chrome': { name: 'Chrome', priceAdd: 0 },
            'black': { name: 'Black', priceAdd: 15 }
        },
        specs: {
            headWeight: '365g',
            shaftWeight: '110g chrome steel',
            lie: '71°',
            loft: '3°',
            length: '35"',
            grip: 'SuperStroke Pistol 2.0',
            feature: 'Extended hosel for arc stroke'
        },
        comingSoon: true
    }
};

export { CONFIG, PRODUCTS };
