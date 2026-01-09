-- =============================================
-- SUITE Apps Table Migration
-- Run in SUITE Ecosystem Supabase: https://supabase.com/dashboard/project/rdsmdywbdiskxknluiym
-- =============================================

-- Drop the old apps table if migrating (optional - be careful!)
-- DROP TABLE IF EXISTS apps;

-- Create the unified suite_apps table with all needed columns
CREATE TABLE IF NOT EXISTS suite_apps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Core Info
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    tagline TEXT,
    description TEXT,
    
    -- Visual
    icon_emoji TEXT,
    icon_url TEXT,
    screenshots TEXT[],  -- Array of screenshot URLs
    
    -- Links
    app_url TEXT,
    download_url TEXT,
    github_url TEXT,
    
    -- Metadata
    category TEXT DEFAULT 'App',
    status TEXT DEFAULT 'development' CHECK (status IN ('development', 'beta', 'published', 'deprecated', 'approved')),
    featured BOOLEAN DEFAULT false,
    
    -- Stats
    rating NUMERIC(2,1) DEFAULT 4.5,
    users_count INTEGER DEFAULT 0,
    downloads_count INTEGER DEFAULT 0,
    
    -- Creator Info
    creator_name TEXT DEFAULT 'SUITE',
    creator_discord_id TEXT,
    
    -- Features (JSON array of strings)
    features JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- Create index for faster lookups by slug
CREATE INDEX IF NOT EXISTS idx_suite_apps_slug ON suite_apps(slug);
CREATE INDEX IF NOT EXISTS idx_suite_apps_status ON suite_apps(status);

-- Enable RLS but allow public read
ALTER TABLE suite_apps ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read apps
CREATE POLICY "Public can read apps" ON suite_apps
    FOR SELECT USING (true);

-- Only authenticated users can insert/update (for future admin panel)
CREATE POLICY "Authenticated can insert apps" ON suite_apps
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update apps" ON suite_apps
    FOR UPDATE USING (auth.role() = 'authenticated');

-- =============================================
-- Insert Cheshbon Reflections
-- =============================================
INSERT INTO suite_apps (
    name, 
    slug, 
    tagline,
    description, 
    icon_emoji,
    icon_url,
    app_url, 
    download_url,
    status, 
    category,
    featured,
    rating,
    users_count,
    features
) VALUES (
    'Cheshbon Reflections',
    'cheshbon-reflections',
    'Journal through insights at your own pace with AI-powered guidance',
    'Daily Bible reading with AI-powered insights and community discussion. Reflect on Scripture together with a global community.',
    '📖',
    NULL,  -- Update with actual icon URL when available
    'https://cheshbon.getsuite.app',
    'https://cheshbon.getsuite.app',
    'published',
    'Spirituality',
    true,
    4.9,
    100,
    '["Daily Scripture readings", "AI-powered insights", "Personal journal", "Community discussions"]'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    app_url = EXCLUDED.app_url,
    download_url = EXCLUDED.download_url,
    status = EXCLUDED.status,
    category = EXCLUDED.category,
    featured = EXCLUDED.featured,
    features = EXCLUDED.features,
    updated_at = NOW();

-- Verify insertion
SELECT * FROM suite_apps WHERE slug = 'cheshbon-reflections';
