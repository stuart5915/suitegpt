-- REMcast Video Generation Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Add video generation columns to dreams
-- ============================================
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS reel_url TEXT;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS reel_duration_seconds INTEGER;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT NULL;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS generation_progress INTEGER DEFAULT 0;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS generation_error TEXT;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;

-- ============================================
-- STEP 2: Create dream-reels storage bucket
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'dream-reels',
    'dream-reels',
    true,
    524288000,  -- 500MB max (videos are large)
    ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STEP 3: Storage bucket RLS policies
-- ============================================

-- Users can upload to their own folder
CREATE POLICY "Users can upload own reels"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'dream-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own reels
CREATE POLICY "Users can read own reels"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'dream-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Public reels are readable by anyone
CREATE POLICY "Anyone can read public reels"
ON storage.objects FOR SELECT
USING (bucket_id = 'dream-reels');

-- Users can delete their own reels
CREATE POLICY "Users can delete own reels"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'dream-reels' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- STEP 4: User credits tracking table
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    video_credits INTEGER DEFAULT 3,  -- Start with 3 free generations
    total_generated INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
ON user_credits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
ON user_credits FOR UPDATE
USING (auth.uid() = user_id);

-- Auto-create credits row for new users
CREATE OR REPLACE FUNCTION create_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_credits (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users (if allowed, otherwise handle in app)
-- Note: This may need to be done via app logic if trigger on auth.users fails

-- ============================================
-- STEP 5: Comments
-- ============================================
COMMENT ON COLUMN dreams.reel_url IS 'URL to generated video reel';
COMMENT ON COLUMN dreams.thumbnail_url IS 'URL to video thumbnail';
COMMENT ON COLUMN dreams.reel_duration_seconds IS 'Total duration of video in seconds';
COMMENT ON COLUMN dreams.generation_status IS 'pending, generating_1, generating_2, generating_3, stitching, uploading, complete, error';
COMMENT ON COLUMN dreams.generation_progress IS 'Progress 0-100';
COMMENT ON TABLE user_credits IS 'Tracks video generation credits per user';
