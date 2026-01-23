-- Create automation_config table for storing automated loop settings
CREATE TABLE IF NOT EXISTS automation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT UNIQUE NOT NULL, -- 'work_log', etc.
    enabled BOOLEAN DEFAULT false,
    post_time TEXT DEFAULT '18:00', -- HH:MM format
    platform TEXT DEFAULT 'x', -- 'x' or 'linkedin'
    auto_approve BOOLEAN DEFAULT true,
    generate_image BOOLEAN DEFAULT true,
    last_run TIMESTAMPTZ,
    next_run TIMESTAMPTZ,
    last_result TEXT, -- 'success', 'error', 'skipped'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on type for fast lookups
CREATE INDEX IF NOT EXISTS idx_automation_config_type ON automation_config(type);

-- Insert default work_log config (disabled by default)
INSERT INTO automation_config (type, enabled, post_time, platform, auto_approve, generate_image)
VALUES ('work_log', false, '18:00', 'x', true, true)
ON CONFLICT (type) DO NOTHING;
