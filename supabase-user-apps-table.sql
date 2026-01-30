-- Create the user_apps table for forked and user-created apps
CREATE TABLE IF NOT EXISTS user_apps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- App identity
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    icon_bg TEXT DEFAULT 'linear-gradient(135deg, #6366f1, #8b5cf6)',

    -- The actual app code
    code TEXT NOT NULL,

    -- Fork tracking
    forked_from TEXT,                    -- Original app key (e.g., 'foodvitals') or NULL if created from scratch
    forked_from_user_app UUID,           -- If forked from another user_app (fork of fork)
    original_creator_id UUID,            -- The original creator (for revenue split)

    -- Revenue split (percentage to current owner, rest to original)
    revenue_split INTEGER DEFAULT 100,   -- 100 = 100% to owner, 90 = 90% owner/10% original

    -- Visibility
    is_public BOOLEAN DEFAULT false,     -- Can others see/use this app?
    is_listed BOOLEAN DEFAULT false,     -- Show in Community Apps directory?

    -- Builder earnings
    builder_markup DECIMAL(12, 4) DEFAULT 0,   -- Credits builder charges on top of base cost
    total_earnings DECIMAL(12, 4) DEFAULT 0,   -- Total credits earned from markup

    -- Stats
    uses INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_apps_user_id ON user_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_user_apps_slug ON user_apps(slug);
CREATE INDEX IF NOT EXISTS idx_user_apps_forked_from ON user_apps(forked_from);
CREATE INDEX IF NOT EXISTS idx_user_apps_is_public ON user_apps(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_user_apps_is_listed ON user_apps(is_listed) WHERE is_listed = true;
CREATE INDEX IF NOT EXISTS idx_user_apps_created_at ON user_apps(created_at DESC);

-- Enable Row Level Security
ALTER TABLE user_apps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-runs)
DROP POLICY IF EXISTS "Users can view own apps" ON user_apps;
DROP POLICY IF EXISTS "Users can view public apps" ON user_apps;
DROP POLICY IF EXISTS "Users can insert own apps" ON user_apps;
DROP POLICY IF EXISTS "Users can update own apps" ON user_apps;
DROP POLICY IF EXISTS "Users can delete own apps" ON user_apps;

-- RLS Policies
-- Users can view their own apps
CREATE POLICY "Users can view own apps" ON user_apps
    FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view public apps
CREATE POLICY "Users can view public apps" ON user_apps
    FOR SELECT USING (is_public = true);

-- Users can only insert their own apps
CREATE POLICY "Users can insert own apps" ON user_apps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own apps
CREATE POLICY "Users can update own apps" ON user_apps
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own apps
CREATE POLICY "Users can delete own apps" ON user_apps
    FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_user_apps_updated_at ON user_apps;
CREATE TRIGGER update_user_apps_updated_at
    BEFORE UPDATE ON user_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_user_apps_updated_at();

-- Function to generate unique slug
CREATE OR REPLACE FUNCTION generate_user_app_slug()
RETURNS TRIGGER AS $$
DECLARE
    base_slug TEXT;
    new_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Generate base slug from name
    base_slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    new_slug := base_slug;

    -- Check for uniqueness within user's apps
    WHILE EXISTS (SELECT 1 FROM user_apps WHERE user_id = NEW.user_id AND slug = new_slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)) LOOP
        counter := counter + 1;
        new_slug := base_slug || '-' || counter;
    END LOOP;

    NEW.slug := new_slug;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-generate slug
DROP TRIGGER IF EXISTS generate_user_app_slug ON user_apps;
CREATE TRIGGER generate_user_app_slug
    BEFORE INSERT OR UPDATE OF name ON user_apps
    FOR EACH ROW
    EXECUTE FUNCTION generate_user_app_slug();

-- Function to increment fork count on original app
CREATE OR REPLACE FUNCTION increment_fork_count()
RETURNS TRIGGER AS $$
BEGIN
    -- If forking from a SUITE app (forked_from is set)
    -- We don't track this in DB, but could add a suite_app_forks table

    -- If forking from another user app
    IF NEW.forked_from_user_app IS NOT NULL THEN
        UPDATE user_apps
        SET forks = forks + 1
        WHERE id = NEW.forked_from_user_app;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to increment fork count
DROP TRIGGER IF EXISTS increment_fork_count ON user_apps;
CREATE TRIGGER increment_fork_count
    AFTER INSERT ON user_apps
    FOR EACH ROW
    WHEN (NEW.forked_from IS NOT NULL OR NEW.forked_from_user_app IS NOT NULL)
    EXECUTE FUNCTION increment_fork_count();
