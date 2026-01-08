-- ============================================
-- SUITE APPS TABLE - Complete Setup
-- Run this in: Cadence Supabase (tbfpopablanksrzyxaxj)
-- ============================================

-- Create the suite_apps table if it doesn't exist
CREATE TABLE IF NOT EXISTS suite_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic Info
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  
  -- Visual
  icon_emoji TEXT DEFAULT '📱',
  category TEXT DEFAULT 'App',
  screenshots JSONB DEFAULT '[]'::jsonb,
  
  -- Features (array of strings)
  features JSONB DEFAULT '[]'::jsonb,
  recent_updates JSONB DEFAULT '[]'::jsonb,
  
  -- Creator/Developer
  creator_wallet TEXT,
  
  -- Stats
  rating DECIMAL(2,1) DEFAULT 4.5,
  users_count INTEGER DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'development' 
    CHECK (status IN ('development', 'beta', 'published', 'deprecated')),
  
  -- Expo/Publishing Info
  expo_project_id TEXT,
  download_url TEXT,
  github_repo TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_suite_apps_status ON suite_apps(status);
CREATE INDEX IF NOT EXISTS idx_suite_apps_slug ON suite_apps(slug);

-- RLS Policies
ALTER TABLE suite_apps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read published apps" ON suite_apps;
DROP POLICY IF EXISTS "Anyone can read all apps" ON suite_apps;
DROP POLICY IF EXISTS "Service role full access" ON suite_apps;

-- Anyone can read all apps (for app store)
CREATE POLICY "Anyone can read all apps" ON suite_apps
  FOR SELECT USING (true);

-- Service role can do anything (for Discord bot)
CREATE POLICY "Service role full access" ON suite_apps
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- SEED DATA - Your Current Apps
-- ============================================

-- Cheshbon (PUBLISHED)
INSERT INTO suite_apps (name, slug, tagline, status, icon_emoji, category, features, recent_updates, published_at)
VALUES (
  'Cheshbon Reflections',
  'cheshbon-reflections',
  'Journal through the Bible at your own pace with AI-powered insights',
  'published',
  '📖',
  'Spirituality',
  '["Daily Bible reading with AI-powered reflections", "Personal journal for spiritual insights", "Bible library with multiple versions", "AI insights that connect passages to your life", "Reading plans and daily reminders", "Community highlights and edification feed", "Profile with your spiritual journey stats", "Notifications for daily readings"]'::jsonb,
  '["Community feed with replies and likes", "Public highlights sharing", "Improved journal entries", "Daily reading notifications"]'::jsonb,
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  status = EXCLUDED.status,
  icon_emoji = EXCLUDED.icon_emoji,
  category = EXCLUDED.category,
  features = EXCLUDED.features,
  recent_updates = EXCLUDED.recent_updates,
  updated_at = NOW();

-- FoodVitals (IN DEVELOPMENT)
INSERT INTO suite_apps (name, slug, tagline, status, icon_emoji, category, features)
VALUES (
  'FoodVitals AI',
  'food-vitals-expo',
  'AI nutrition tracking with camera analysis',
  'development',
  '🍎',
  'Health',
  '["Camera food scanning with barcode support", "AI photo analysis with Gemini", "Macro tracking (protein, carbs, fat, fiber)", "Micronutrient tracking", "Quick re-log recent meals"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  icon_emoji = EXCLUDED.icon_emoji,
  category = EXCLUDED.category,
  features = EXCLUDED.features,
  updated_at = NOW();

-- OpticRep (IN DEVELOPMENT)
INSERT INTO suite_apps (name, slug, tagline, status, icon_emoji, category, features)
VALUES (
  'OpticRep',
  'opticrep',
  'AI workout trainer with form tracking',
  'development',
  '🏋️',
  'Fitness',
  '["Camera-based form tracking", "Pre-built workout templates", "Warm-up routines", "Workout summaries with stats"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  icon_emoji = EXCLUDED.icon_emoji,
  category = EXCLUDED.category,
  features = EXCLUDED.features,
  updated_at = NOW();
