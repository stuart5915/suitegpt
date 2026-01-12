-- TELOS Mode Database Updates
-- Run this in your Supabase SQL Editor

-- Add prompt_type column to prompts table if it doesn't exist
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS prompt_type TEXT DEFAULT 'human';

-- Add metadata column for TELOS app details
ALTER TABLE prompts 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Create index for TELOS prompts
CREATE INDEX IF NOT EXISTS idx_prompts_type ON prompts(prompt_type);

-- Create ai_config table for TELOS settings (if not exists)
CREATE TABLE IF NOT EXISTS ai_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Public read ai_config" ON ai_config
    FOR SELECT USING (true);

-- Service role can update
CREATE POLICY "Service role update ai_config" ON ai_config
    FOR ALL USING (auth.role() = 'service_role');

-- Insert default TELOS config
INSERT INTO ai_config (key, value) 
VALUES (
    'telos_mode',
    '{
        "enabled": false,
        "focus_areas": ["Productivity", "Health", "Finance"],
        "max_daily": 6,
        "cooldown_hours": 4,
        "auto_deploy": true
    }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- View to see TELOS apps created today
CREATE OR REPLACE VIEW telos_apps_today AS
SELECT 
    id,
    prompt,
    metadata->>'app_name' as app_name,
    metadata->>'focus_area' as focus_area,
    status,
    created_at
FROM prompts 
WHERE prompt_type = 'telos' 
AND created_at >= CURRENT_DATE
ORDER BY created_at DESC;
