-- Add Twitter posting fields to scheduled_posts table
-- Run this in Supabase SQL Editor

ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS twitter_post_id TEXT,
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for finding posts ready to publish
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_ready
ON scheduled_posts (status, scheduled_for)
WHERE status = 'approved';
