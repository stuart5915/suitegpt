-- Add processing columns to dreams table
-- Run this in Supabase SQL Editor

-- Add title column if not exists
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS title TEXT;

-- Add processing status columns
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending';
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS processing_error TEXT;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Create index on processing status for efficient queries
CREATE INDEX IF NOT EXISTS idx_dreams_processing_status ON dreams(processing_status);

-- Comment on columns
COMMENT ON COLUMN dreams.title IS 'AI-generated dream title';
COMMENT ON COLUMN dreams.processing_status IS 'pending, transcribing, analyzing, complete, error';
COMMENT ON COLUMN dreams.processing_error IS 'Error message if processing failed';
COMMENT ON COLUMN dreams.processed_at IS 'Timestamp when processing completed';
