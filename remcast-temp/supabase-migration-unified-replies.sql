-- Migration: Unified Reply-as-Reflection Architecture
-- Replies are now full public_reflections with a parent link
-- Run this in Supabase SQL Editor

-- Add parent_reflection_id column for reply chains
ALTER TABLE public_reflections 
ADD COLUMN IF NOT EXISTS parent_reflection_id UUID REFERENCES public_reflections(id) ON DELETE CASCADE;

-- Add parent_display_name for quick access without joins
ALTER TABLE public_reflections 
ADD COLUMN IF NOT EXISTS parent_display_name TEXT;

-- Create index for efficient reply queries
CREATE INDEX IF NOT EXISTS idx_public_reflections_parent 
ON public_reflections(parent_reflection_id) 
WHERE parent_reflection_id IS NOT NULL;
