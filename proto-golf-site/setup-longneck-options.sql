-- Long Neck Blade: Enable and Configure
-- Run this in Supabase SQL Editor

-- Update Long Neck Blade to active status with correct base price
UPDATE proto_golf_products
SET
    status = 'active',
    base_price = 110,
    description = 'The Long Neck Blade features an extended hosel design optimized for players with an arc putting stroke. Choose your face mill pattern, head finish, hosel, and shaft to build your custom putter.',
    badge = 'New'
WHERE id = 'long-neck-blade';

-- Ensure shared inventory has the Long Neck head variants
-- (Only inserts if they don't already exist)
INSERT INTO proto_golf_shared_inventory (item_type, item_name, stock, price_addon, sort_order)
VALUES
    ('longneck_head', 'Squiggle', 0, 0.00, 1),
    ('longneck_head', 'Conventional', 0, 0.00, 2),
    ('longneck_head', 'Hex', 0, 0.00, 3)
ON CONFLICT (item_type, item_name) DO NOTHING;
