-- Proto Golf Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- PRODUCTS TABLE (Inventory by model, not variant)
-- ============================================
CREATE TABLE proto_golf_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    base_price DECIMAL(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'coming_soon')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial products
INSERT INTO proto_golf_products (id, name, base_price, stock, status) VALUES
    ('rough-mill', 'Rough Mill', 399.00, 20, 'active'),
    ('centre-blade', 'Centre Blade', 449.00, 15, 'active'),
    ('long-neck-blade', 'Long Neck Blade', 429.00, 0, 'coming_soon');

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE proto_golf_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,

    -- Customer Info
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,

    -- Product Details
    product_id TEXT NOT NULL REFERENCES proto_golf_products(id),
    product_name TEXT NOT NULL,
    finish TEXT NOT NULL,
    shaft_color TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,

    -- Delivery
    delivery_method TEXT NOT NULL CHECK (delivery_method IN ('shipping', 'pickup')),
    shipping_address JSONB, -- {line1, line2, city, state, postal_code, country}
    pickup_date DATE,
    pickup_time TEXT,

    -- Shipping (if applicable)
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    shipping_label_url TEXT,
    tracking_number TEXT,

    -- Totals
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,

    -- Payment
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),

    -- Order Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'ready_for_pickup', 'completed', 'cancelled')),
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    shipped_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Create order number sequence
CREATE SEQUENCE proto_golf_order_seq START 1001;

-- Function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'PG-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(nextval('proto_golf_order_seq')::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE TRIGGER set_order_number
    BEFORE INSERT ON proto_golf_orders
    FOR EACH ROW
    EXECUTE FUNCTION generate_order_number();

-- ============================================
-- ANALYTICS TABLE
-- ============================================
CREATE TABLE proto_golf_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL, -- 'page_view', 'product_view', 'add_to_cart', 'checkout_started', 'checkout_completed', 'checkout_abandoned'
    product_id TEXT REFERENCES proto_golf_products(id),
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    session_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster analytics queries
CREATE INDEX idx_analytics_event_type ON proto_golf_analytics(event_type);
CREATE INDEX idx_analytics_product ON proto_golf_analytics(product_id);
CREATE INDEX idx_analytics_created ON proto_golf_analytics(created_at);

-- ============================================
-- PICKUP SLOTS TABLE
-- ============================================
CREATE TABLE proto_golf_pickup_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    max_bookings INTEGER DEFAULT 2,
    current_bookings INTEGER DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, time_slot)
);

-- ============================================
-- EMAIL NOTIFICATIONS LOG
-- ============================================
CREATE TABLE proto_golf_email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES proto_golf_orders(id),
    email_type TEXT NOT NULL, -- 'order_confirmation', 'shipping_notification', 'pickup_reminder', 'admin_notification'
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'sent'
);

-- ============================================
-- PRODUCT IMAGES TABLE (Admin-managed photos)
-- ============================================
CREATE TABLE proto_golf_product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES proto_golf_products(id),
    variant_key TEXT NOT NULL, -- e.g. 'Raw|Chrome', 'Gun Blue|Black'
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_images_product ON proto_golf_product_images(product_id);
CREATE INDEX idx_product_images_variant ON proto_golf_product_images(product_id, variant_key);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE proto_golf_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE proto_golf_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE proto_golf_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE proto_golf_pickup_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE proto_golf_email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE proto_golf_product_images ENABLE ROW LEVEL SECURITY;

-- Products: Anyone can read, only authenticated (admin) can modify
CREATE POLICY "Products are viewable by everyone" ON proto_golf_products
    FOR SELECT USING (true);

CREATE POLICY "Products are editable by authenticated users" ON proto_golf_products
    FOR ALL USING (auth.role() = 'authenticated');

-- Orders: Insert allowed for anyone (checkout), read/update for authenticated
CREATE POLICY "Anyone can create orders" ON proto_golf_orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Orders viewable by authenticated users" ON proto_golf_orders
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Orders editable by authenticated users" ON proto_golf_orders
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Analytics: Anyone can insert, only authenticated can read
CREATE POLICY "Anyone can log analytics" ON proto_golf_analytics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Analytics viewable by authenticated" ON proto_golf_analytics
    FOR SELECT USING (auth.role() = 'authenticated');

-- Product images: Anyone can read, authenticated can modify
CREATE POLICY "Product images viewable by everyone" ON proto_golf_product_images
    FOR SELECT USING (true);

CREATE POLICY "Product images editable by authenticated" ON proto_golf_product_images
    FOR ALL USING (auth.role() = 'authenticated');

-- Pickup slots: Anyone can read, authenticated can modify
CREATE POLICY "Pickup slots viewable by everyone" ON proto_golf_pickup_slots
    FOR SELECT USING (true);

CREATE POLICY "Pickup slots editable by authenticated" ON proto_golf_pickup_slots
    FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to decrement stock when order is placed
CREATE OR REPLACE FUNCTION decrement_product_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE proto_golf_products
    SET stock = stock - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_created
    AFTER INSERT ON proto_golf_orders
    FOR EACH ROW
    WHEN (NEW.payment_status = 'paid')
    EXECUTE FUNCTION decrement_product_stock();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_timestamp
    BEFORE UPDATE ON proto_golf_products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_orders_timestamp
    BEFORE UPDATE ON proto_golf_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- VIEWS FOR ADMIN DASHBOARD
-- ============================================

-- Daily analytics summary
CREATE VIEW proto_golf_daily_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) FILTER (WHERE event_type = 'page_view') as page_views,
    COUNT(*) FILTER (WHERE event_type = 'product_view') as product_views,
    COUNT(*) FILTER (WHERE event_type = 'add_to_cart') as add_to_carts,
    COUNT(*) FILTER (WHERE event_type = 'checkout_started') as checkouts_started,
    COUNT(*) FILTER (WHERE event_type = 'checkout_completed') as checkouts_completed
FROM proto_golf_analytics
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Order summary
CREATE VIEW proto_golf_order_summary AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_orders,
    SUM(total) as revenue,
    COUNT(*) FILTER (WHERE delivery_method = 'shipping') as shipped_orders,
    COUNT(*) FILTER (WHERE delivery_method = 'pickup') as pickup_orders
FROM proto_golf_orders
WHERE payment_status = 'paid'
GROUP BY DATE(created_at)
ORDER BY date DESC;
