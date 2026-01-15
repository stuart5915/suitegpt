-- SUITE Apps Table - Add Screenshot Columns Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/rdsmdywbdiskxknluiym

-- Add 5 individual screenshot columns to the apps table
-- These will store URLs for up to 5 app screenshots

ALTER TABLE apps ADD COLUMN IF NOT EXISTS screenshot_1 TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS screenshot_2 TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS screenshot_3 TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS screenshot_4 TEXT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS screenshot_5 TEXT;

-- Also add tagline column if it doesn't exist (used in Start Building page)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Add free/pro feature columns if they don't exist
ALTER TABLE apps ADD COLUMN IF NOT EXISTS free_features JSONB DEFAULT '[]'::jsonb;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS pro_features JSONB DEFAULT '[]'::jsonb;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS pro_price INTEGER DEFAULT 10;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'apps' 
AND column_name IN ('screenshot_1', 'screenshot_2', 'screenshot_3', 'screenshot_4', 'screenshot_5', 'tagline', 'free_features', 'pro_features', 'pro_price')
ORDER BY column_name;
