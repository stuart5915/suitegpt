-- App Factory Project Tracking Schema
-- Run this in Supabase SQL Editor

-- Track app factory projects
CREATE TABLE IF NOT EXISTS app_factory_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  slug TEXT UNIQUE,
  category TEXT,
  description TEXT,

  -- Progress tracking
  step INTEGER DEFAULT 0,  -- 0=define, 1=features, 2=build, 3=deploy
  prompts_completed JSONB DEFAULT '[]',

  -- Config collected from each step
  config JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_factory_projects_slug ON app_factory_projects(slug);
CREATE INDEX IF NOT EXISTS idx_app_factory_projects_created ON app_factory_projects(created_at DESC);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_app_factory_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_factory_projects_updated ON app_factory_projects;
CREATE TRIGGER app_factory_projects_updated
  BEFORE UPDATE ON app_factory_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_app_factory_timestamp();

-- Enable RLS
ALTER TABLE app_factory_projects ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (admin only page)
CREATE POLICY "Allow all access to app_factory_projects"
  ON app_factory_projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant access
GRANT ALL ON app_factory_projects TO anon;
GRANT ALL ON app_factory_projects TO authenticated;
