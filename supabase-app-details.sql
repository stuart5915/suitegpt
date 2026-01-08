-- App Detail Page - Database Migration
-- Run this in your Supabase SQL Editor (Cadence project)

-- Add new columns to suite_apps for app detail pages
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS icon_emoji TEXT DEFAULT '📱';
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'App';
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS screenshots JSONB DEFAULT '[]'::jsonb;
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS creator_wallet TEXT;
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 4.5;
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS users_count INTEGER DEFAULT 0;

-- Update existing apps with proper categories and icons
UPDATE suite_apps SET icon_emoji = '📖', category = 'Spirituality' WHERE slug = 'cheshbon-reflections';
UPDATE suite_apps SET icon_emoji = '🍎', category = 'Health' WHERE slug = 'food-vitals-expo';
UPDATE suite_apps SET icon_emoji = '🏋️', category = 'Fitness' WHERE slug = 'opticrep';
UPDATE suite_apps SET icon_emoji = '🎙️', category = 'Audio' WHERE slug = 'remcast';
UPDATE suite_apps SET icon_emoji = '🧘', category = 'Health' WHERE slug = 'trueform-expo';
UPDATE suite_apps SET icon_emoji = '💭', category = 'Wellness' WHERE slug = 'revibe';
