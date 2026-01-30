-- Add shaft_price_addon column to proto_golf_variants
-- Allows independent pricing for shaft options (e.g., black shaft upcharge)
ALTER TABLE proto_golf_variants
ADD COLUMN IF NOT EXISTS shaft_price_addon NUMERIC DEFAULT 0;
