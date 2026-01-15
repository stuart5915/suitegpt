-- Migration: Add demographic fields to profiles for personalization
-- These fields help the AI personalize exercise recommendations

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation_type TEXT 
    CHECK (occupation_type IS NULL OR occupation_type IN ('sedentary', 'active', 'physical'));

-- Add comments explaining the fields
COMMENT ON COLUMN profiles.age IS 'User age in years for exercise personalization';
COMMENT ON COLUMN profiles.occupation_type IS 'sedentary=desk work, active=mixed standing/walking, physical=manual labor';
