-- REMcast Dream Audio Storage Bucket Migration
-- Run this in your Supabase SQL Editor AFTER running supabase-migration-dreams.sql

-- ============================================
-- STEP 1: Create the dream-audio storage bucket
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'dream-audio',
    'dream-audio',
    true,  -- Public bucket for easy access
    52428800,  -- 50MB max file size
    ARRAY['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/x-m4a']
);

-- ============================================
-- STEP 2: RLS Policies for the storage bucket
-- ============================================

-- Users can upload audio to their own folder (folder name = user_id)
CREATE POLICY "Users can upload own audio"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'dream-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own audio files
CREATE POLICY "Users can read own audio"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'dream-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Anyone can read public audio (for shared dreams on the feed)
CREATE POLICY "Anyone can read public dream audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'dream-audio');

-- Users can delete their own audio files
CREATE POLICY "Users can delete own audio"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'dream-audio' AND
    auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================
-- Check bucket exists:
-- SELECT * FROM storage.buckets WHERE id = 'dream-audio';

-- Check policies:
-- SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%audio%';
