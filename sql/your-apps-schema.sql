-- Your Apps / Projects Schema Migration
-- Adds support for saved apps per user and app tiers

-- ============================================
-- 1. Add tier column to apps table
-- ============================================
ALTER TABLE apps ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'app';
-- Values: 'tool', 'app', 'solution'

COMMENT ON COLUMN apps.tier IS 'App tier classification: tool (quick utilities), app (full-featured), solution (business/enterprise)';

-- ============================================
-- 2. Add creator tracking to apps table
-- ============================================
ALTER TABLE apps ADD COLUMN IF NOT EXISTS creator_user_id UUID REFERENCES factory_users(id);

COMMENT ON COLUMN apps.creator_user_id IS 'User who created/proposed this app (for revenue sharing)';

-- ============================================
-- 3. Create user_saved_apps table
-- ============================================
CREATE TABLE IF NOT EXISTS user_saved_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES factory_users(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, app_slug)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_saved_apps_user_id ON user_saved_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_apps_app_slug ON user_saved_apps(app_slug);

-- ============================================
-- 4. Row Level Security for user_saved_apps
-- ============================================
ALTER TABLE user_saved_apps ENABLE ROW LEVEL SECURITY;

-- Users can read their own saved apps
CREATE POLICY "Users can read own saved apps" ON user_saved_apps
    FOR SELECT USING (true);

-- Users can save apps
CREATE POLICY "Users can save apps" ON user_saved_apps
    FOR INSERT WITH CHECK (true);

-- Users can unsave their own apps
CREATE POLICY "Users can unsave own apps" ON user_saved_apps
    FOR DELETE USING (true);

-- ============================================
-- 5. Creator earnings table (for future use)
-- ============================================
CREATE TABLE IF NOT EXISTS creator_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES factory_users(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    credits_earned INTEGER DEFAULT 0,
    source_type TEXT DEFAULT 'usage', -- 'usage', 'tip', 'subscription'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator_id ON creator_earnings(creator_id);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_app_slug ON creator_earnings(app_slug);
CREATE INDEX IF NOT EXISTS idx_creator_earnings_created_at ON creator_earnings(created_at);

-- RLS for creator_earnings
ALTER TABLE creator_earnings ENABLE ROW LEVEL SECURITY;

-- Creators can read their own earnings
CREATE POLICY "Creators can read own earnings" ON creator_earnings
    FOR SELECT USING (true);

-- Only system can insert earnings (via edge functions)
CREATE POLICY "System can insert earnings" ON creator_earnings
    FOR INSERT WITH CHECK (true);

-- ============================================
-- 6. Update existing apps with tier values
-- ============================================
-- Tools (quick utilities)
UPDATE apps SET tier = 'tool' WHERE slug IN (
    'hydrotrack', 'focusflow', 'quickbudget', 'breatheasy',
    'stretchtimer', 'quickdecide', 'stepgoal'
);

-- Solutions (business/enterprise)
UPDATE apps SET tier = 'solution' WHERE slug IN (
    'proto-golf'
);

-- Everything else defaults to 'app' which is the default value
