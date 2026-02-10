-- Add min_stake_clawnch column to human_profiles
-- Minimum $CLAWNCH an agent must stake on this human's profile

ALTER TABLE human_profiles
ADD COLUMN IF NOT EXISTS min_stake_clawnch integer DEFAULT 0;
