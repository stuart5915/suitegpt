-- Add columns needed for the self-serve publish flow on clients.suitegpt.app
-- Run this in the Supabase SQL editor

ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS publisher_email TEXT;
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS source TEXT;

-- Ensure slug uniqueness (only for non-null slugs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_apps_slug_unique ON user_apps(slug) WHERE slug IS NOT NULL;

-- Allow anonymous inserts for published client sites (no auth required)
-- The existing RLS may block service-key inserts; ensure service role bypasses RLS
-- (service role bypasses RLS by default in Supabase, so this should work as-is)
