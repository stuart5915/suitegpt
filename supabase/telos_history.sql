-- TELOS.md History Table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS telos_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    type TEXT DEFAULT 'refinement' CHECK (type IN ('genesis', 'addition', 'refinement', 'attack', 'support')),
    title TEXT NOT NULL,
    description TEXT,
    target_principle INTEGER,
    author TEXT DEFAULT 'Stuart Hollinger',
    author_wallet TEXT,
    is_admin_submission BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    suite_cost INTEGER DEFAULT 0,
    reward_paid INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT
);

-- Enable Row Level Security
ALTER TABLE telos_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read history (public audit trail)
CREATE POLICY "Public read access" ON telos_history
    FOR SELECT USING (true);

-- Only authenticated/service role can insert
CREATE POLICY "Insert access" ON telos_history
    FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_telos_history_version ON telos_history(version);
CREATE INDEX idx_telos_history_created ON telos_history(created_at DESC);
CREATE INDEX idx_telos_history_type ON telos_history(type);

-- Insert Genesis entry
INSERT INTO telos_history (version, type, title, description, author, is_admin_submission, status, approved_at)
VALUES (
    '1.0.0',
    'genesis',
    'Initial Constitution Created',
    '5 core principles established: Truth Over Untruth, Human Flourishing, Transparency, Sustainability, Alignment with Creator''s Intent. This marks the beginning of the TELOS.md document that governs all AI systems in the SUITE ecosystem.',
    'Stuart Hollinger (Founder)',
    TRUE,
    'approved',
    NOW()
);
