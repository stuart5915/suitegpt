-- Movement Reports Table
-- Stores AI-generated analysis reports for user movements

CREATE TABLE IF NOT EXISTS movement_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Session Info
  movement_name TEXT NOT NULL,
  movement_emoji TEXT,
  duration_seconds INTEGER,
  
  -- Questionnaire Data
  pain_location TEXT[],
  pain_duration TEXT,
  pain_triggers TEXT[],
  pain_type TEXT[],
  prior_injuries TEXT,
  
  -- Analysis Results
  ai_report TEXT NOT NULL,
  pain_points_count INTEGER DEFAULT 0,
  avg_intensity DECIMAL(3,1),
  frame_count INTEGER DEFAULT 0,
  
  -- Metadata
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  processing_time_ms INTEGER
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_movement_reports_user_id ON movement_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_movement_reports_created_at ON movement_reports(created_at DESC);

-- Row Level Security
ALTER TABLE movement_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own reports" ON movement_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON movement_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON movement_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON movement_reports;

-- RLS Policies
CREATE POLICY "Users can view own reports"
  ON movement_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports"
  ON movement_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports"
  ON movement_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports"
  ON movement_reports FOR DELETE
  USING (auth.uid() = user_id);
