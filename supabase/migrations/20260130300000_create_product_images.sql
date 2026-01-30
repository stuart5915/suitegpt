-- Create product images table (was in schema.sql but never migrated)
CREATE TABLE IF NOT EXISTS proto_golf_product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL REFERENCES proto_golf_products(id),
    variant_key TEXT NOT NULL,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON proto_golf_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_variant ON proto_golf_product_images(product_id, variant_key);

ALTER TABLE proto_golf_product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product images viewable by everyone" ON proto_golf_product_images
    FOR SELECT USING (true);

CREATE POLICY "Product images insertable by anyone" ON proto_golf_product_images
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Product images updatable by anyone" ON proto_golf_product_images
    FOR UPDATE USING (true);

CREATE POLICY "Product images deletable by anyone" ON proto_golf_product_images
    FOR DELETE USING (true);
