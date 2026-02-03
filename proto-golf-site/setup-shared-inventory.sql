-- Proto Golf: Shared Inventory Table
-- This table tracks inventory that is shared across all product models

CREATE TABLE IF NOT EXISTS proto_golf_shared_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL,        -- 'shaft', 'longneck_head', 'hosel'
    item_name TEXT NOT NULL,        -- 'Chrome', 'Black', 'Squiggle', 'Brass', etc.
    stock INTEGER DEFAULT 0,
    price_addon DECIMAL(10,2) DEFAULT 0.00,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on type + name
CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_inventory_type_name
ON proto_golf_shared_inventory(item_type, item_name);

-- Insert default inventory items
INSERT INTO proto_golf_shared_inventory (item_type, item_name, stock, price_addon, sort_order)
VALUES
    -- Shafts (shared across all putter models)
    ('shaft', 'Chrome', 20, 0.00, 1),
    ('shaft', 'Black', 20, 12.00, 2),

    -- Long Neck Blade head variants (separate inventory per style)
    ('longneck_head', 'Squiggle', 10, 0.00, 1),
    ('longneck_head', 'Conventional', 10, 0.00, 2),
    ('longneck_head', 'Hex', 10, 0.00, 3),

    -- Hosels (shared across all putter models)
    ('hosel', 'Brass', 15, 35.00, 1),
    ('hosel', 'Stainless', 20, 0.00, 2)
ON CONFLICT (item_type, item_name) DO NOTHING;

-- Notes:
-- Stainless hosel has optional Black Oxide coating (+$25) - stored in frontend localStorage for now
-- Shaft length 36.5"+ upcharge ($15) - stored in frontend localStorage for now
