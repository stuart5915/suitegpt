-- Add username column to public_reflections table
-- Run this in Supabase SQL Editor

-- Add username column (nullable for existing rows)
ALTER TABLE public_reflections ADD COLUMN IF NOT EXISTS username TEXT;

-- Create index for username lookups
CREATE INDEX IF NOT EXISTS idx_public_reflections_username ON public_reflections(username);
