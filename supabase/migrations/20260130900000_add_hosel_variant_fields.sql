-- Add hosel variant fields to proto_golf_variants
-- hosel_type: e.g. Brass, Stainless
-- hosel_finish: e.g. Blasted, Black Oxide
-- hosel_price_addon: extra cost for certain hosel options
ALTER TABLE proto_golf_variants
    ADD COLUMN IF NOT EXISTS hosel_type text,
    ADD COLUMN IF NOT EXISTS hosel_finish text,
    ADD COLUMN IF NOT EXISTS hosel_price_addon decimal(10,2) DEFAULT 0;
