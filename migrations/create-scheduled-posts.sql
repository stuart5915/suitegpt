-- Migration: Create scheduled_posts table for content queue
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL DEFAULT 'x',
    content_type TEXT NOT NULL,
    app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
    post_text TEXT NOT NULL,
    images JSONB DEFAULT '[]'::jsonb,
    scheduled_for TIMESTAMPTZ,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    posted_at TIMESTAMPTZ
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform ON scheduled_posts(platform);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);

-- Enable RLS
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust based on your auth needs)
CREATE POLICY "Allow all operations on scheduled_posts" ON scheduled_posts
    FOR ALL USING (true) WITH CHECK (true);

-- Add comment
COMMENT ON TABLE scheduled_posts IS 'Content queue for scheduled social media posts across platforms';
