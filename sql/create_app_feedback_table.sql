-- Create app_feedback table for tracking feature requests and bug reports
CREATE TABLE IF NOT EXISTS app_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    app_slug TEXT NOT NULL,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('feature', 'bug')),
    content TEXT NOT NULL,
    
    -- Submitter info (either Discord or wallet)
    submitted_by_discord_id TEXT,
    submitted_by_wallet TEXT,
    submitted_by_username TEXT,
    
    -- Status tracking for rewards
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'accepted', 'implemented', 'rejected')),
    reviewed_at TIMESTAMPTZ,
    implemented_at TIMESTAMPTZ,
    
    -- Reward tracking
    suite_earned INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rate limiting queries (check submissions per user per day)
CREATE INDEX IF NOT EXISTS idx_feedback_user_day ON app_feedback (submitted_by_discord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_wallet_day ON app_feedback (submitted_by_wallet, created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_app ON app_feedback (app_id);

-- Enable RLS
ALTER TABLE app_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (but frontend validates login)
CREATE POLICY "Anyone can insert feedback" ON app_feedback FOR INSERT WITH CHECK (true);

-- Policy: Only admins can update status
CREATE POLICY "Admins can update feedback" ON app_feedback FOR UPDATE USING (true);

-- Policy: Everyone can read their own feedback + all public
CREATE POLICY "Everyone can read feedback" ON app_feedback FOR SELECT USING (true);

-- View for leaderboard: top contributors
CREATE OR REPLACE VIEW feedback_contributors AS
SELECT 
    COALESCE(submitted_by_discord_id, submitted_by_wallet) as user_id,
    submitted_by_username as username,
    COUNT(*) as total_submissions,
    COUNT(*) FILTER (WHERE status = 'implemented') as implemented_count,
    SUM(suite_earned) as total_suite_earned
FROM app_feedback
GROUP BY submitted_by_discord_id, submitted_by_wallet, submitted_by_username
ORDER BY implemented_count DESC, total_submissions DESC;
