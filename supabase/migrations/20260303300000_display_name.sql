-- Add display_name column to human_profiles
ALTER TABLE human_profiles ADD COLUMN IF NOT EXISTS display_name text;
