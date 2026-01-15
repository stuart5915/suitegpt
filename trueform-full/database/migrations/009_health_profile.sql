-- Health Profile Fields Migration
-- Run this in Supabase SQL Editor to add health intake fields to profiles

-- Add health profile columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_lbs INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_inches INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medical_conditions TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_notes TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_profile_complete BOOLEAN DEFAULT FALSE;

-- Create index for health profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_health_complete ON profiles(health_profile_complete);

-- Function to check if health profile is complete
CREATE OR REPLACE FUNCTION is_health_profile_complete(profile_row profiles)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    profile_row.weight_lbs IS NOT NULL AND
    profile_row.height_inches IS NOT NULL AND
    profile_row.birth_year IS NOT NULL AND
    profile_row.activity_level IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Comment for documentation
COMMENT ON COLUMN profiles.weight_lbs IS 'User weight in pounds';
COMMENT ON COLUMN profiles.height_inches IS 'User height in total inches';
COMMENT ON COLUMN profiles.birth_year IS 'User birth year for age calculation';
COMMENT ON COLUMN profiles.activity_level IS 'Activity level: sedentary, light, moderate, active';
COMMENT ON COLUMN profiles.medical_conditions IS 'Array of medical conditions for exercise safety';
COMMENT ON COLUMN profiles.health_profile_complete IS 'True if required health fields are filled';
