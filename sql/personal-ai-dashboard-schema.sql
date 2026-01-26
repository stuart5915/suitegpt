-- Personal AI Dashboard Schema
-- Enables unified app data storage and AI insights across SUITE apps

-- ============================================
-- Table: user_app_data
-- Unified app data storage (JSONB for flexibility)
-- ============================================
CREATE TABLE IF NOT EXISTS user_app_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES factory_users(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, app_slug)
);

-- Enable RLS
ALTER TABLE user_app_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own app data
CREATE POLICY "Users can read their own app data"
    ON user_app_data FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own app data"
    ON user_app_data FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own app data"
    ON user_app_data FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own app data"
    ON user_app_data FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================
-- Table: user_ai_settings
-- AI preferences per user
-- ============================================
CREATE TABLE IF NOT EXISTS user_ai_settings (
    user_id UUID PRIMARY KEY REFERENCES factory_users(id) ON DELETE CASCADE,
    data_sync_enabled BOOLEAN DEFAULT false,
    ai_insights_enabled BOOLEAN DEFAULT false,
    notification_frequency TEXT DEFAULT 'never' CHECK (notification_frequency IN ('never', 'daily', 'weekly')),
    apps_included TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users can read their own AI settings"
    ON user_ai_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI settings"
    ON user_ai_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings"
    ON user_ai_settings FOR UPDATE
    USING (auth.uid() = user_id);


-- ============================================
-- Table: user_saved_apps
-- Saved apps synced to cloud (replaces localStorage for logged-in users)
-- ============================================
CREATE TABLE IF NOT EXISTS user_saved_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES factory_users(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    position INTEGER DEFAULT 0,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, app_slug)
);

-- Enable RLS
ALTER TABLE user_saved_apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own saved apps"
    ON user_saved_apps FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved apps"
    ON user_saved_apps FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved apps"
    ON user_saved_apps FOR DELETE
    USING (auth.uid() = user_id);


-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_app_data_user ON user_app_data(user_id);
CREATE INDEX IF NOT EXISTS idx_user_app_data_gin ON user_app_data USING GIN (data);
CREATE INDEX IF NOT EXISTS idx_user_app_data_app_slug ON user_app_data(app_slug);
CREATE INDEX IF NOT EXISTS idx_user_saved_apps_user ON user_saved_apps(user_id);


-- ============================================
-- Function: upsert_app_data
-- Insert or update app data for a user
-- ============================================
CREATE OR REPLACE FUNCTION upsert_app_data(
    p_user_id UUID,
    p_app_slug TEXT,
    p_data JSONB
)
RETURNS user_app_data
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result user_app_data;
BEGIN
    INSERT INTO user_app_data (user_id, app_slug, data, last_synced_at)
    VALUES (p_user_id, p_app_slug, p_data, NOW())
    ON CONFLICT (user_id, app_slug)
    DO UPDATE SET
        data = p_data,
        last_synced_at = NOW()
    RETURNING * INTO result;

    RETURN result;
END;
$$;


-- ============================================
-- Function: get_user_insights_data
-- Get all app data for a user (for AI insights)
-- Only returns data for apps user has opted into
-- ============================================
CREATE OR REPLACE FUNCTION get_user_insights_data(p_user_id UUID)
RETURNS TABLE (
    app_slug TEXT,
    data JSONB,
    last_synced_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT uad.app_slug, uad.data, uad.last_synced_at
    FROM user_app_data uad
    JOIN user_ai_settings uas ON uad.user_id = uas.user_id
    WHERE uad.user_id = p_user_id
      AND uas.ai_insights_enabled = true
      AND uad.app_slug = ANY(uas.apps_included);
END;
$$;


-- ============================================
-- Function: sync_saved_apps
-- Sync localStorage savedApps to cloud
-- ============================================
CREATE OR REPLACE FUNCTION sync_saved_apps(
    p_user_id UUID,
    p_app_slugs TEXT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Remove apps not in the new list
    DELETE FROM user_saved_apps
    WHERE user_id = p_user_id
      AND app_slug != ALL(p_app_slugs);

    -- Insert new apps with position
    INSERT INTO user_saved_apps (user_id, app_slug, position)
    SELECT p_user_id, slug, idx
    FROM unnest(p_app_slugs) WITH ORDINALITY AS t(slug, idx)
    ON CONFLICT (user_id, app_slug)
    DO UPDATE SET position = EXCLUDED.position;
END;
$$;
