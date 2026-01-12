-- Apologetics Arena Database Schema
-- Run this in your Supabase SQL Editor

-- Create the apologetics_challenges table
CREATE TABLE IF NOT EXISTS apologetics_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_text TEXT NOT NULL,
    submitter_wallet TEXT,
    refutation_text TEXT,
    is_novel BOOLEAN DEFAULT FALSE,
    novelty_score FLOAT DEFAULT 0,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'refuted', 'flagged', 'rewarded')),
    suite_cost INTEGER DEFAULT 10,
    reward_paid INTEGER DEFAULT 0,
    ai_judge_model TEXT DEFAULT 'gemini-2.0-flash',
    reasoning_depth INTEGER DEFAULT 0,
    scripture_cited TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    refuted_at TIMESTAMP WITH TIME ZONE
);

-- Enable Row Level Security
ALTER TABLE apologetics_challenges ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read challenges
CREATE POLICY "Anyone can view challenges" ON apologetics_challenges
    FOR SELECT USING (true);

-- Allow anyone to submit challenges (anon key)
CREATE POLICY "Anyone can submit challenges" ON apologetics_challenges
    FOR INSERT WITH CHECK (true);

-- Only service role can update (for AI Judge)
CREATE POLICY "Service role can update" ON apologetics_challenges
    FOR UPDATE USING (auth.role() = 'service_role');

-- Create index for faster queries
CREATE INDEX idx_apologetics_status ON apologetics_challenges(status);
CREATE INDEX idx_apologetics_created ON apologetics_challenges(created_at DESC);
CREATE INDEX idx_apologetics_novel ON apologetics_challenges(is_novel) WHERE is_novel = TRUE;

-- Insert a sample challenge for testing
INSERT INTO apologetics_challenges (challenge_text, status, is_novel, refutation_text)
VALUES (
    'How can a loving God allow suffering?',
    'refuted',
    FALSE,
    'The problem of evil, while profound, is addressed through free will, soul-making theodicy, and the redemptive purpose of suffering in Scripture (Romans 8:28, James 1:2-4). A world without suffering would lack genuine moral freedom and the opportunity for spiritual growth.'
);
