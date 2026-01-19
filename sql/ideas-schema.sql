-- Ideas Pipeline Schema
-- Tracks all app ideas from conception to launch
-- Run this in Supabase SQL Editor

-- Create ideas table
CREATE TABLE IF NOT EXISTS ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,

  -- Status: rejected, considering, building, live
  status TEXT DEFAULT 'considering',

  -- If rejected, why?
  rejection_reason TEXT,

  -- If live, link to the app
  app_slug TEXT REFERENCES apps(slug),

  -- Metrics
  votes INTEGER DEFAULT 0,
  twitter_url TEXT,  -- Link to X/Twitter poll/post

  -- Category (same as apps)
  category TEXT,

  -- Revenue potential notes
  revenue_notes TEXT,

  -- Build complexity 1-5
  complexity INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,  -- When status changed from considering
  launched_at TIMESTAMPTZ  -- When it became live
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_ideas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ideas_updated ON ideas;
CREATE TRIGGER ideas_updated
  BEFORE UPDATE ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_ideas_timestamp();

-- Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to ideas"
  ON ideas
  FOR SELECT
  USING (true);

-- Allow authenticated write (admin only in practice)
CREATE POLICY "Allow authenticated write to ideas"
  ON ideas
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant access
GRANT SELECT ON ideas TO anon;
GRANT ALL ON ideas TO authenticated;

-- Insert some sample ideas to start
INSERT INTO ideas (name, tagline, status, category, complexity, revenue_notes) VALUES
  ('Voice Memo AI', 'Turn voice notes into structured summaries', 'considering', 'productivity', 2, 'Pay per transcription/summary'),
  ('Habit Streak', 'Track daily habits with streak rewards', 'considering', 'health', 2, 'Premium habit packs'),
  ('Receipt Scanner', 'Scan receipts and track expenses', 'rejected', 'finance', 3, 'Good potential but crowded market'),
  ('AI Workout Coach', 'Personalized workout plans from AI', 'building', 'health', 4, 'Per-workout generation fee')
ON CONFLICT DO NOTHING;

-- Update the rejection reason for the rejected idea
UPDATE ideas SET rejection_reason = 'Too many competitors (Mint, Expensify, etc.). Hard to differentiate.' WHERE name = 'Receipt Scanner';
