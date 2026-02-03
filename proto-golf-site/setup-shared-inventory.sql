-- Proto Golf: Shared Inventory Table
-- This table tracks inventory that is shared across all product models (e.g., shafts)

CREATE TABLE IF NOT EXISTS proto_golf_shared_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL,        -- 'shaft', 'grip', etc.
    item_name TEXT NOT NULL,        -- 'Chrome', 'Black', etc.
    stock INTEGER DEFAULT 0,
    price_addon DECIMAL(10,2) DEFAULT 0.00,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on type + name
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_inventory_type_name
ON proto_golf_shared_inventory(item_type, item_name);

-- Insert default shaft inventory
INSERT INTO proto_golf_shared_inventory (item_type, item_name, stock, price_addon, sort_order)
VALUES
    ('shaft', 'Chrome', 20, 0.00, 1),
    ('shaft', 'Black', 20, 12.00, 2)
ON CONFLICT (item_type, item_name) DO NOTHING;

-- Also add a finish_options JSONB column to proto_golf_products if it doesn't exist
-- This will store available finishes and their prices per product
-- ALTER TABLE proto_golf_products ADD COLUMN IF NOT EXISTS finish_options JSONB;

-- Example finish_options format:
-- [
--   {"name": "Polished", "price": 105.00, "is_default": true},
--   {"name": "Black Oxide", "price": 120.00},
--   {"name": "Mineral Torch", "price": 125.00}
-- ]
