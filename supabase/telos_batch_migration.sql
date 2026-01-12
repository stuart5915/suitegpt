-- TELOS Ideas Table Migration
-- Adds batch_id and why_now columns for intelligent batch ideation
-- Run this in Supabase SQL Editor

-- Add batch_id to group ideas from the same generation
ALTER TABLE telos_ideas ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Add why_now field for explaining timeliness
ALTER TABLE telos_ideas ADD COLUMN IF NOT EXISTS why_now TEXT;

-- Index for batch grouping
CREATE INDEX IF NOT EXISTS idx_telos_ideas_batch ON telos_ideas(batch_id);

-- Allow anon key to update (for dashboard)
DROP POLICY IF EXISTS "Anon update telos_ideas" ON telos_ideas;
CREATE POLICY "Anon update telos_ideas" ON telos_ideas
    FOR UPDATE USING (true) WITH CHECK (true);

-- Allow anon key to insert (for watcher)
DROP POLICY IF EXISTS "Anon insert telos_ideas" ON telos_ideas;
CREATE POLICY "Anon insert telos_ideas" ON telos_ideas
    FOR INSERT WITH CHECK (true);
