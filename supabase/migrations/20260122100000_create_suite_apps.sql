-- SUITE Apps Table Migration
-- Stores app listings for the suite-shell app directory

CREATE TABLE IF NOT EXISTS suite_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT,
    description TEXT,
    category TEXT DEFAULT 'productivity' CHECK (category IN ('health', 'productivity', 'finance', 'creative', 'games', 'other')),
    status TEXT DEFAULT 'live' CHECK (status IN ('live', 'coming_soon', 'beta', 'hidden')),
    icon_url TEXT,
    app_url TEXT,  -- External URL if not a suite-shell app
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookup by slug
CREATE INDEX IF NOT EXISTS idx_suite_apps_slug ON suite_apps(slug);
-- Index for filtering by category and status
CREATE INDEX IF NOT EXISTS idx_suite_apps_category_status ON suite_apps(category, status);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

ALTER TABLE suite_apps ENABLE ROW LEVEL SECURITY;

-- Everyone can read visible apps (not hidden)
DROP POLICY IF EXISTS "apps_select_public" ON suite_apps;
CREATE POLICY "apps_select_public" ON suite_apps
    FOR SELECT USING (status != 'hidden');

-- Only service role can insert/update/delete (admin operations via edge functions)
-- For direct admin access, you can add specific policies or use service_role key

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_suite_apps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS suite_apps_updated_at ON suite_apps;
CREATE TRIGGER suite_apps_updated_at
    BEFORE UPDATE ON suite_apps
    FOR EACH ROW
    EXECUTE FUNCTION update_suite_apps_updated_at();

-- =============================================
-- SEED DATA: Current SUITE Apps
-- =============================================
INSERT INTO suite_apps (name, slug, tagline, description, category, status, icon_url) VALUES
    ('TrueForm', 'trueform', 'Recovery tracking', 'Track your fitness recovery with AI-powered insights', 'health', 'live', '/assets/icons/trueform-icon.jpg'),
    ('FoodVitals', 'foodvitals', 'Nutrition scanner', 'Scan food labels and get instant nutrition analysis', 'health', 'live', '/assets/icons/foodvitals-icon.png'),
    ('Cheshbon', 'cheshbon', 'Daily reflection', 'AI-guided daily reflection and journaling', 'productivity', 'live', '/assets/icons/cheshbon-icon.png'),
    ('OpticRep', 'opticrep', 'Rep counter', 'AI-powered workout rep counter using your camera', 'health', 'live', '/assets/icons/opticrep-icon.png'),
    ('RemCast', 'remcast', 'Audio journaling', 'Record voice memos and get AI summaries', 'productivity', 'live', '/assets/icons/remcast-icon.png'),
    ('NoteBox', 'notebox', 'Audio learning', 'Turn podcasts and videos into notes', 'productivity', 'live', '/assets/icons/notebox-icon.png'),
    ('SUITEhub', 'suitehub', 'Your digital home', 'Central hub for all your SUITE activities', 'productivity', 'live', '/assets/suite-logo-new.png'),
    ('DeFi Knowledge', 'defi-knowledge', 'Master DeFi', 'Learn decentralized finance with AI tutoring', 'finance', 'coming_soon', '/assets/icons/defi-knowledge-icon.png')
ON CONFLICT (slug) DO NOTHING;
