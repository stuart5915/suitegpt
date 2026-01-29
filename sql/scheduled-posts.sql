-- Scheduled Posts table for auto-posting via Vercel Cron
-- Run this in the Supabase SQL Editor

CREATE TABLE scheduled_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin')),
    post_text TEXT NOT NULL,
    image_url TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'failed')),
    cadence TEXT,
    date_key TEXT,
    theme TEXT,
    twitter_post_id TEXT,
    linkedin_post_id TEXT,
    posted_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron job: find scheduled posts that are due
CREATE INDEX idx_scheduled_posts_due ON scheduled_posts (status, scheduled_for)
    WHERE status = 'scheduled';

-- Index for calendar display: fetch by date range
CREATE INDEX idx_scheduled_posts_date ON scheduled_posts (date_key, status);

-- RLS: allow anon key full access (single-user tool)
ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON scheduled_posts FOR ALL USING (true) WITH CHECK (true);
