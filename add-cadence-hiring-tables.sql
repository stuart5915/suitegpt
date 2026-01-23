-- Cadence AI Hiring System Tables
-- Run this in your Supabase SQL Editor

-- Cadence AI Hiring Loops Configuration
CREATE TABLE IF NOT EXISTS cadence_hiring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loop_type TEXT NOT NULL, -- 'hiring', 'app_marketing', etc.
    is_active BOOLEAN DEFAULT false,
    platforms JSONB DEFAULT '{}', -- {"x": true, "linkedin": true, ...}
    posting_frequency TEXT DEFAULT 'daily', -- 'daily', 'twice_daily', 'weekly'
    posting_times TEXT[] DEFAULT ARRAY['10:00', '18:00'],
    message_templates JSONB DEFAULT '[]',
    last_post_at TIMESTAMPTZ,
    next_post_at TIMESTAMPTZ,
    stats JSONB DEFAULT '{"posts_count": 0, "applications_count": 0}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Board Postings (manual tracking for external platforms)
CREATE TABLE IF NOT EXISTS job_board_postings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    platform TEXT NOT NULL, -- 'cryptojobslist', 'indeed', 'web3career', etc.
    platform_url TEXT, -- Direct link to the posting
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'taken_down'
    applications_count INTEGER DEFAULT 0,
    posted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE cadence_hiring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_board_postings ENABLE ROW LEVEL SECURITY;

-- Policies (admin access through service role, read for anon)
CREATE POLICY "Anyone can read hiring config" ON cadence_hiring_config FOR SELECT USING (true);
CREATE POLICY "Anyone can insert hiring config" ON cadence_hiring_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update hiring config" ON cadence_hiring_config FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete hiring config" ON cadence_hiring_config FOR DELETE USING (true);

CREATE POLICY "Anyone can read job postings" ON job_board_postings FOR SELECT USING (true);
CREATE POLICY "Anyone can insert job postings" ON job_board_postings FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update job postings" ON job_board_postings FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete job postings" ON job_board_postings FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_cadence_hiring_config_type ON cadence_hiring_config(loop_type);
CREATE INDEX IF NOT EXISTS idx_cadence_hiring_config_active ON cadence_hiring_config(is_active);
CREATE INDEX IF NOT EXISTS idx_job_board_postings_platform ON job_board_postings(platform);
CREATE INDEX IF NOT EXISTS idx_job_board_postings_status ON job_board_postings(status);

-- Grant access
GRANT ALL ON cadence_hiring_config TO anon, authenticated;
GRANT ALL ON job_board_postings TO anon, authenticated;

-- Insert default hiring loop config
INSERT INTO cadence_hiring_config (loop_type, is_active, platforms, posting_frequency, message_templates)
VALUES (
    'hiring',
    false,
    '{"x": true, "linkedin": true, "instagram": true}',
    'daily',
    '[
        "Want to run your own app business? No coding needed. SUITE is hiring App Operators - earn 90% revenue from apps you manage. Marketing budget included. Apply: getsuite.app/become-operator",
        "SUITE is hiring! Become an App Operator and earn 90% of your apps revenue. No coding required - we handle the tech, you grow the business. Apply now: getsuite.app/become-operator",
        "Looking for a side hustle with real ownership? SUITE App Operators earn 90% revenue share + get marketing budget. Take ownership of an app today: getsuite.app/become-operator"
    ]'
)
ON CONFLICT DO NOTHING;

INSERT INTO cadence_hiring_config (loop_type, is_active, platforms, posting_frequency, message_templates)
VALUES (
    'app_marketing',
    false,
    '{"x": true, "instagram": true}',
    'daily',
    '[]'
)
ON CONFLICT DO NOTHING;
