-- ================================
-- CADENCE AI - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- PROJECTS TABLE
-- ================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  brand_voice TEXT,
  target_audience TEXT,
  content_pillars TEXT[] DEFAULT '{}',
  platforms TEXT[] DEFAULT '{}',
  posting_schedule JSONB,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX idx_projects_user_id ON projects(user_id);

-- RLS Policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- ================================
-- WEEKLY PLANS TABLE
-- ================================
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed')),
  ai_proposal TEXT,
  user_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint: one plan per project per week
  UNIQUE(project_id, week_start)
);

-- Index for faster queries
CREATE INDEX idx_weekly_plans_project_id ON weekly_plans(project_id);
CREATE INDEX idx_weekly_plans_week_start ON weekly_plans(week_start);

-- RLS Policies
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own weekly plans"
  ON weekly_plans FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert weekly plans for their projects"
  ON weekly_plans FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own weekly plans"
  ON weekly_plans FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own weekly plans"
  ON weekly_plans FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- ================================
-- CONTENT ITEMS TABLE
-- ================================
CREATE TABLE content_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_plan_id UUID REFERENCES weekly_plans ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects ON DELETE CASCADE NOT NULL,
  
  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  platform TEXT NOT NULL CHECK (platform IN ('x', 'instagram', 'linkedin', 'tiktok', 'youtube')),
  
  -- Content
  content_type TEXT NOT NULL CHECK (content_type IN (
    'text', 'image', 'carousel', 'infographic', 'comparison', 'collage',
    'knowledge', 'testimonial', 'behind_scenes', 'video_script', 'ai_video',
    'story', 'thread', 'poll', 'live_prompt'
  )),
  caption TEXT,
  media_urls TEXT[] DEFAULT '{}',
  hashtags TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'scheduled', 'posted', 'failed')),
  posted_at TIMESTAMPTZ,
  
  -- AI context
  ai_reasoning TEXT,
  media_prompt TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_content_items_project_id ON content_items(project_id);
CREATE INDEX idx_content_items_weekly_plan_id ON content_items(weekly_plan_id);
CREATE INDEX idx_content_items_scheduled_date ON content_items(scheduled_date);
CREATE INDEX idx_content_items_status ON content_items(status);

-- RLS Policies
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own content items"
  ON content_items FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert content items for their projects"
  ON content_items FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own content items"
  ON content_items FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own content items"
  ON content_items FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- ================================
-- CONVERSATIONS TABLE
-- ================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_plan_id UUID REFERENCES weekly_plans ON DELETE CASCADE,
  content_item_id UUID REFERENCES content_items ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_weekly_plan_id ON conversations(weekly_plan_id);
CREATE INDEX idx_conversations_content_item_id ON conversations(content_item_id);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations for their weekly plans"
  ON conversations FOR SELECT
  USING (
    weekly_plan_id IN (
      SELECT wp.id FROM weekly_plans wp
      JOIN projects p ON wp.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR content_item_id IN (
      SELECT ci.id FROM content_items ci
      JOIN projects p ON ci.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert conversations for their weekly plans"
  ON conversations FOR INSERT
  WITH CHECK (
    weekly_plan_id IN (
      SELECT wp.id FROM weekly_plans wp
      JOIN projects p ON wp.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
    OR content_item_id IN (
      SELECT ci.id FROM content_items ci
      JOIN projects p ON ci.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- ================================
-- UPDATED_AT TRIGGER
-- ================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_plans_updated_at
  BEFORE UPDATE ON weekly_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_items_updated_at
  BEFORE UPDATE ON content_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
