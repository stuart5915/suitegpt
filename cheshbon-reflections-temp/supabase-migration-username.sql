-- Add username column to user_profiles table
-- Run this in Supabase SQL Editor

-- Add username column (unique, nullable initially)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Add constraint for username format (optional - enforces at DB level)
-- Lowercase letters, numbers, underscores only, 3-20 chars
ALTER TABLE user_profiles ADD CONSTRAINT username_format 
    CHECK (username IS NULL OR (
        username ~ '^[a-z][a-z0-9_]{2,19}$'
    ));

