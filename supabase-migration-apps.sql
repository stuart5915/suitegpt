-- SUITE App Store - Apps Table Migration
-- Run this in your Supabase SQL Editor

-- Create the apps table
CREATE TABLE IF NOT EXISTS apps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon_url TEXT,
    screenshot_url TEXT,
    creator_name TEXT NOT NULL,
    creator_discord_id TEXT,
    app_url TEXT,
    category TEXT DEFAULT 'utility',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'featured')),
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_creator ON apps(creator_discord_id);

-- Enable Row Level Security
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read approved apps (for the public app store)
CREATE POLICY "Anyone can read approved apps"
    ON apps FOR SELECT
    USING (status = 'approved' OR status = 'featured');

-- Policy: Service role can do everything (for the Discord bot)
CREATE POLICY "Service role has full access"
    ON apps FOR ALL
    USING (auth.role() = 'service_role');

-- Policy: Users can read their own pending apps
CREATE POLICY "Users can read own apps"
    ON apps FOR SELECT
    USING (creator_discord_id = auth.jwt()->>'sub');

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_apps_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample apps for testing (optional - remove in production)
INSERT INTO apps (name, slug, description, icon_url, creator_name, app_url, status, category) VALUES
    ('OpticRep', 'opticrep', 'AI-powered workout form analyzer', 'https://example.com/opticrep-icon.png', 'Stuart H.', 'https://opticrep.getsuite.app', 'approved', 'fitness'),
    ('FoodVitals', 'foodvitals', 'Smart nutrition tracking with AI', 'https://example.com/foodvitals-icon.png', 'Maria G.', 'https://foodvitals.getsuite.app', 'approved', 'health'),
    ('MindMap', 'mindmap', 'Visual thinking and brainstorming', 'https://example.com/mindmap-icon.png', 'Alex P.', 'https://mindmap.getsuite.app', 'approved', 'productivity')
ON CONFLICT (slug) DO NOTHING;
