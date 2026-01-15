-- ============================================
-- ADD FRAME THUMBNAILS TO MOVEMENT REPORTS
-- Run this in Supabase SQL Editor
-- ============================================

-- Add frame_thumbnails column to store compressed thumbnail images as base64
-- Stores ~10 tiny images (100x75px JPEG) around the pain point
-- Each thumbnail is ~3-5KB, total ~30-50KB per report
ALTER TABLE movement_reports 
ADD COLUMN IF NOT EXISTS frame_thumbnails JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN movement_reports.frame_thumbnails IS 'Array of base64-encoded thumbnails centered around pain point frames';
