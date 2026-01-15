-- Add profile columns to user_profiles table
-- Run this in Supabase SQL Editor

-- Add missing columns for full profile support
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Update the primary key to use user_id instead of id for easier lookups
-- (The table uses id as PK but queries by user_id - let's make id = user_id for simplicity)
-- Note: Only run this if your table isn't already using id = user_id pattern

-- Allow public reading of profiles for community features
-- Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Anyone can read public profiles" ON user_profiles;
CREATE POLICY "Anyone can read public profiles"
  ON user_profiles FOR SELECT
  USING (true);
