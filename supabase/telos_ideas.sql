-- TELOS Ideas Approval Queue
-- Run this in Supabase SQL Editor

-- Create telos_ideas table for pending approval
CREATE TABLE IF NOT EXISTS telos_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tagline TEXT,
    description TEXT,
    features JSONB,
    focus_area TEXT,
    target_audience TEXT,
    monetization TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'building', 'review', 'deployed', 'scrapped')),
    generated_prompt TEXT,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    build_started_at TIMESTAMP WITH TIME ZONE,
    build_completed_at TIMESTAMP WITH TIME ZONE,
    deployed_at TIMESTAMP WITH TIME ZONE,
    -- Metadata
    rejection_reason TEXT,
    refinement_notes TEXT,
    prompt_id UUID,  -- Links to prompts table when building
    build_iterations INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE telos_ideas ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Public read telos_ideas" ON telos_ideas
    FOR SELECT USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access" ON telos_ideas
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can update (for dashboard)
CREATE POLICY "Authenticated update" ON telos_ideas
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_telos_ideas_status ON telos_ideas(status);
CREATE INDEX IF NOT EXISTS idx_telos_ideas_created ON telos_ideas(created_at DESC);

-- Also add summary to suite_apps for better duplicate detection
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS features JSONB;
ALTER TABLE suite_apps ADD COLUMN IF NOT EXISTS tech_stack TEXT[];

-- View for pending ideas
CREATE OR REPLACE VIEW telos_pending_ideas AS
SELECT * FROM telos_ideas WHERE status = 'pending' ORDER BY created_at DESC;

-- View for ideas ready for review (build complete)
CREATE OR REPLACE VIEW telos_review_queue AS
SELECT * FROM telos_ideas WHERE status = 'review' ORDER BY build_completed_at DESC;
