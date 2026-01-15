-- REMcast Dreams Table Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Create the dream_mood enum type
-- ============================================
CREATE TYPE dream_mood AS ENUM (
  'peaceful',
  'chaotic', 
  'surreal',
  'prophetic',
  'lucid',
  'nightmare',
  'nostalgic',
  'adventurous'
);

-- ============================================
-- STEP 2: Create the dreams table
-- ============================================
CREATE TABLE dreams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Audio & Transcription
  audio_url TEXT,              -- Original voice recording URL (Supabase Storage)
  transcript TEXT,             -- Whisper transcription output
  
  -- AI-Generated Content
  scenes JSONB,                -- Array of 3 visual scene descriptions
                               -- Example: [{"description": "...", "timestamp": 0}, ...]
  reel_url TEXT,               -- Generated video URL (Runway/Luma output)
  
  -- Metadata
  mood dream_mood,             -- Enum: peaceful, chaotic, surreal, etc.
  character_seed TEXT,         -- Optional: recurring dream character description
  is_public BOOLEAN DEFAULT false,  -- Visibility in community feed
  
  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 3: Create performance indexes
-- ============================================
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_created_at ON dreams(created_at DESC);
CREATE INDEX idx_dreams_is_public ON dreams(is_public) WHERE is_public = true;
CREATE INDEX idx_dreams_mood ON dreams(mood);

-- ============================================
-- STEP 4: Enable Row Level Security
-- ============================================
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;

-- Users can read their own dreams (private or public)
CREATE POLICY "Users can view own dreams"
  ON dreams FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can view public dreams
CREATE POLICY "Anyone can view public dreams"
  ON dreams FOR SELECT
  USING (is_public = true);

-- Users can insert their own dreams
CREATE POLICY "Users can create own dreams"
  ON dreams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own dreams
CREATE POLICY "Users can update own dreams"
  ON dreams FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own dreams  
CREATE POLICY "Users can delete own dreams"
  ON dreams FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_dreams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dreams_updated_at
  BEFORE UPDATE ON dreams
  FOR EACH ROW
  EXECUTE FUNCTION update_dreams_updated_at();

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================
-- Check table exists:
-- SELECT * FROM dreams LIMIT 1;

-- Check enum values:
-- SELECT enum_range(NULL::dream_mood);

-- Check RLS policies:
-- SELECT * FROM pg_policies WHERE tablename = 'dreams';
