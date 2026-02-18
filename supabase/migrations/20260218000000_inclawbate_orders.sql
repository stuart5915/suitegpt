-- Inclawbate Store Orders
CREATE TABLE IF NOT EXISTS inclawbate_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID REFERENCES human_profiles(id),
    product TEXT NOT NULL DEFAULT 'lobster-putter',
    quantity INT NOT NULL DEFAULT 1,

    -- Shipping
    shipping_name TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_state TEXT NOT NULL,
    shipping_zip TEXT NOT NULL,
    shipping_country TEXT NOT NULL,
    shipping_tier TEXT NOT NULL CHECK (shipping_tier IN ('us', 'canada', 'international')),

    -- Payment
    inclawnch_amount NUMERIC NOT NULL,
    usd_equivalent NUMERIC NOT NULL,
    inclawnch_price_at_purchase NUMERIC NOT NULL,
    tx_hash TEXT UNIQUE NOT NULL,

    -- Status
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'processing', 'shipped', 'delivered', 'refunded')),
    tracking_number TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

-- Index for admin lookups
CREATE INDEX idx_inclawbate_orders_status ON inclawbate_orders(status);
CREATE INDEX idx_inclawbate_orders_profile ON inclawbate_orders(profile_id);
CREATE INDEX idx_inclawbate_orders_tx ON inclawbate_orders(tx_hash);
