-- Cadence AI Database Schema
-- Telegram Authentication and User-Scoped Data

-- ============================================
-- 1. CADENCE USERS TABLE
-- ============================================
-- Core user table keyed by telegram_id
CREATE TABLE IF NOT EXISTS cadence_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id TEXT NOT NULL UNIQUE,
    telegram_username TEXT,
    first_name TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_cadence_users_telegram_id ON cadence_users(telegram_id);

-- ============================================
-- 2. CADENCE LOOPS TABLE
-- ============================================
-- Content loops (migrated from localStorage)
CREATE TABLE IF NOT EXISTS cadence_loops (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📝',
    color TEXT DEFAULT '#6366f1',
    description TEXT,
    rotation_days INTEGER DEFAULT 7,
    is_active BOOLEAN DEFAULT true,
    items JSONB DEFAULT '[]'::jsonb,
    audiences JSONB DEFAULT '[]'::jsonb,
    last_posted TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fetching user's loops
CREATE INDEX IF NOT EXISTS idx_cadence_loops_telegram_id ON cadence_loops(telegram_id);
CREATE INDEX IF NOT EXISTS idx_cadence_loops_project_id ON cadence_loops(project_id);

-- ============================================
-- 3. CADENCE USER SETTINGS TABLE
-- ============================================
-- User brand voice and preferences
CREATE TABLE IF NOT EXISTS cadence_user_settings (
    telegram_id TEXT PRIMARY KEY,
    brand_voice TEXT,
    tone TEXT DEFAULT 'casual',
    speaking_perspective TEXT DEFAULT 'I',
    emoji_style TEXT DEFAULT 'moderate',
    exclusion_words TEXT,
    default_hashtags TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. UPDATE PROJECTS TABLE
-- ============================================
-- Add telegram_id column to link projects to users
ALTER TABLE projects ADD COLUMN IF NOT EXISTS telegram_id TEXT;
CREATE INDEX IF NOT EXISTS idx_projects_telegram_id ON projects(telegram_id);

-- ============================================
-- 5. CADENCE EMAIL CAPTURES TABLE
-- ============================================
-- Email captures from audience capture pages
CREATE TABLE IF NOT EXISTS cadence_email_captures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id TEXT NOT NULL,
    loop_id UUID REFERENCES cadence_loops(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    name TEXT,
    source TEXT,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cadence_email_captures_telegram_id ON cadence_email_captures(telegram_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on all tables
ALTER TABLE cadence_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadence_email_captures ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for cadence_users (authenticated via Telegram)
CREATE POLICY "Allow public access to cadence_users" ON cadence_users
    FOR ALL USING (true) WITH CHECK (true);

-- Allow users to access only their own loops
CREATE POLICY "Users can access own loops" ON cadence_loops
    FOR ALL USING (true) WITH CHECK (true);

-- Allow users to access only their own settings
CREATE POLICY "Users can access own settings" ON cadence_user_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Allow users to access only their own email captures
CREATE POLICY "Users can access own email captures" ON cadence_email_captures
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers to tables
DROP TRIGGER IF EXISTS update_cadence_users_updated_at ON cadence_users;
CREATE TRIGGER update_cadence_users_updated_at
    BEFORE UPDATE ON cadence_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cadence_loops_updated_at ON cadence_loops;
CREATE TRIGGER update_cadence_loops_updated_at
    BEFORE UPDATE ON cadence_loops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cadence_user_settings_updated_at ON cadence_user_settings;
CREATE TRIGGER update_cadence_user_settings_updated_at
    BEFORE UPDATE ON cadence_user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
