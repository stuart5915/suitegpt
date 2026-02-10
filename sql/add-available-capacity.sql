-- Add available_capacity column to human_profiles
-- Percentage (0-100) of time/attention a human is offering to agents
-- Stakers get proportional share: agent_share = (agent_stake / total_staked) * available_capacity

ALTER TABLE human_profiles
ADD COLUMN IF NOT EXISTS available_capacity integer DEFAULT 100;
