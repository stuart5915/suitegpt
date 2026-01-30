-- Proto Golf Migration: Add product details + variants table
-- Run against existing database

-- 1. Add new columns to proto_golf_products
ALTER TABLE proto_golf_products
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS short_description TEXT,
    ADD COLUMN IF NOT EXISTS material TEXT,
    ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS hero_image TEXT,
    ADD COLUMN IF NOT EXISTS icon TEXT,
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS badge TEXT;

-- 2. Seed existing products with new column data
UPDATE proto_golf_products SET
    description = 'The Rough Mill is our signature putter, CNC-milled from solid 304 stainless steel stock. The raw machined texture provides a classic, industrial aesthetic while the precision engineering ensures consistent performance on the green.',
    short_description = '304 Stainless Steel CNC milled. 370g head. Raw machined texture.',
    material = '304 Stainless Steel',
    specs = '{"headWeight":"370g","shaftWeight":"110g chrome steel","lie":"72°","loft":"3°","length":"35\"","grip":"SuperStroke Pistol 2.0 Style"}'::jsonb,
    hero_image = 'assets/putters/polished-rough-mill-1.png',
    icon = 'R',
    sort_order = 1,
    badge = 'In Stock'
WHERE id = 'rough-mill';

UPDATE proto_golf_products SET
    description = 'The Centre Blade features our zero torque design, CNC-milled from 1045 carbon steel. The gun blue finish provides a classic, refined look while the white sight line paint fill offers precise alignment. All-black shaft and grip for a sleek, unified appearance.',
    short_description = '1045 Carbon Steel. 360g head. Zero torque design with gun blue finish.',
    material = '1045 Carbon Steel',
    specs = '{"headWeight":"360g","shaftWeight":"110g chrome steel","lie":"71°","loft":"3°","length":"35\"","grip":"SuperStroke Pistol 2.0 Style (all black)","finish":"Gun Blue","paintFill":"White sight line","feature":"Zero torque design"}'::jsonb,
    hero_image = 'assets/putters/polished-centre-blade-1.png',
    icon = 'C',
    sort_order = 2,
    badge = 'New'
WHERE id = 'centre-blade';

UPDATE proto_golf_products SET
    description = 'The Long Neck Blade features an extended hosel design optimized for players with an arc putting stroke. The extended neck provides improved balance and a more natural feel through the stroke. CNC-milled from premium materials for exceptional quality and consistency.',
    short_description = 'Extended hosel design for arc putting strokes. Premium construction.',
    material = '304 Stainless Steel',
    specs = '{"headWeight":"365g","shaftWeight":"110g chrome steel","lie":"71°","loft":"3°","length":"35\"","grip":"SuperStroke Pistol 2.0 Style","feature":"Extended hosel for arc strokes"}'::jsonb,
    hero_image = 'assets/putters/stainless-long-neck-blade-1.png',
    icon = 'L',
    sort_order = 3,
    badge = 'Coming Soon'
WHERE id = 'long-neck-blade';

-- 3. Create variants table
CREATE TABLE IF NOT EXISTS proto_golf_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES proto_golf_products(id),
    finish_name TEXT NOT NULL,
    shaft_color TEXT NOT NULL,
    price_addon DECIMAL(10,2) DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON proto_golf_variants(product_id);

-- 4. Seed variants (only if table is empty)
INSERT INTO proto_golf_variants (product_id, finish_name, shaft_color, price_addon, sort_order, is_default)
SELECT * FROM (VALUES
    ('rough-mill', 'Raw', 'Chrome', 0::decimal, 1, true),
    ('rough-mill', 'Raw', 'Black', 0::decimal, 2, false),
    ('rough-mill', 'Brushed', 'Chrome', 50::decimal, 3, false),
    ('rough-mill', 'Brushed', 'Black', 50::decimal, 4, false),
    ('rough-mill', 'Black DLC', 'Chrome', 100::decimal, 5, false),
    ('rough-mill', 'Black DLC', 'Black', 100::decimal, 6, false),
    ('rough-mill', 'Chrome', 'Chrome', 75::decimal, 7, false),
    ('rough-mill', 'Chrome', 'Black', 75::decimal, 8, false),
    ('centre-blade', 'Gun Blue', 'Black', 0::decimal, 1, true),
    ('long-neck-blade', 'Raw', 'Chrome', 0::decimal, 1, true),
    ('long-neck-blade', 'Raw', 'Black', 0::decimal, 2, false),
    ('long-neck-blade', 'Brushed', 'Chrome', 25::decimal, 3, false),
    ('long-neck-blade', 'Brushed', 'Black', 25::decimal, 4, false)
) AS v(product_id, finish_name, shaft_color, price_addon, sort_order, is_default)
WHERE NOT EXISTS (SELECT 1 FROM proto_golf_variants LIMIT 1);

-- 5. RLS for variants
ALTER TABLE proto_golf_variants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proto_golf_variants' AND policyname = 'Variants are viewable by everyone') THEN
        CREATE POLICY "Variants are viewable by everyone" ON proto_golf_variants FOR SELECT USING (true);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'proto_golf_variants' AND policyname = 'Variants are editable by authenticated users') THEN
        CREATE POLICY "Variants are editable by authenticated users" ON proto_golf_variants FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END $$;
