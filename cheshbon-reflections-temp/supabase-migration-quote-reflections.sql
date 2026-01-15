-- Add quoted_reflection_id for quote reflections
-- Run this in Supabase SQL Editor

-- 1. Add column for quote reflections
ALTER TABLE public_reflections 
ADD COLUMN IF NOT EXISTS quoted_reflection_id UUID REFERENCES public_reflections(id);

-- 2. Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_public_reflections_quoted 
ON public_reflections(quoted_reflection_id) 
WHERE quoted_reflection_id IS NOT NULL;
