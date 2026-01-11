-- AI Fleet Dashboard - Database Schema
-- Run these in Supabase SQL Editor

-- ==========================================
-- 1. AI Activity Log Table
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    action_type TEXT NOT NULL,  -- 'research', 'start_build', 'iteration', 'deploy', 'error', 'telos'
    message TEXT NOT NULL,
    app_id UUID,
    app_name TEXT,
    iteration_number INT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast recent queries
CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON ai_activity_log(timestamp DESC);

-- Enable realtime for live activity feed
ALTER PUBLICATION supabase_realtime ADD TABLE ai_activity_log;

-- ==========================================
-- 2. AI Config Table
-- ==========================================
CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Default config values
INSERT INTO ai_config (key, value, description) VALUES
('iterations_per_app', '50', 'Number of refinement iterations before deploy'),
('max_apps_per_day', '6', 'Maximum new apps to create per day'),
('auto_deploy', 'true', 'Auto-deploy after iterations complete'),
('telos_enabled', 'true', 'AI picks next project when queue empty'),
('research_focus', 'productivity,health,finance,creativity', 'Categories to prioritize'),
('min_self_test_passes', '3', 'Required self-test passes before deploy')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- 3. Add columns to suite_apps (if not exists)
-- ==========================================
DO $$ 
BEGIN
    -- Add origin column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suite_apps' AND column_name = 'origin') THEN
        ALTER TABLE suite_apps ADD COLUMN origin TEXT DEFAULT 'human';
    END IF;
    
    -- Add iteration_count column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suite_apps' AND column_name = 'iteration_count') THEN
        ALTER TABLE suite_apps ADD COLUMN iteration_count INT DEFAULT 0;
    END IF;
    
    -- Add auto_deployed column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suite_apps' AND column_name = 'auto_deployed') THEN
        ALTER TABLE suite_apps ADD COLUMN auto_deployed BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add telos_generated column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suite_apps' AND column_name = 'telos_generated') THEN
        ALTER TABLE suite_apps ADD COLUMN telos_generated BOOLEAN DEFAULT FALSE;
    END IF;
    
    -- Add ai_research_source column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suite_apps' AND column_name = 'ai_research_source') THEN
        ALTER TABLE suite_apps ADD COLUMN ai_research_source TEXT;
    END IF;
END $$;

-- ==========================================
-- 4. RLS Policies
-- ==========================================

-- Activity log: Anyone can read, only service role can insert
ALTER TABLE ai_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read activity log" ON ai_activity_log
    FOR SELECT USING (true);

CREATE POLICY "Service role can insert activity" ON ai_activity_log
    FOR INSERT WITH CHECK (true);

-- Config: Anyone can read, only owner can update
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read config" ON ai_config
    FOR SELECT USING (true);

-- Note: Config updates should be done via service role or admin API
