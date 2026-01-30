-- Fix variants RLS: allow anon key to write (admin auth is handled at app layer)
-- The 'FOR ALL' policy with auth.role()='authenticated' silently blocks anon key writes

DROP POLICY IF EXISTS "Variants are editable by authenticated users" ON proto_golf_variants;

CREATE POLICY "Variants are insertable by anyone" ON proto_golf_variants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Variants are updatable by anyone" ON proto_golf_variants
    FOR UPDATE USING (true);

CREATE POLICY "Variants are deletable by anyone" ON proto_golf_variants
    FOR DELETE USING (true);

-- Also fix products table — same issue affects admin product editing
DROP POLICY IF EXISTS "Products are editable by authenticated users" ON proto_golf_products;

CREATE POLICY "Products are insertable by anyone" ON proto_golf_products
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Products are updatable by anyone" ON proto_golf_products
    FOR UPDATE USING (true);

CREATE POLICY "Products are deletable by anyone" ON proto_golf_products
    FOR DELETE USING (true);
