-- Add reward split percentage to treasury config (default 80% to rewards, 20% to LP)
ALTER TABLE inclawbate_ubi_treasury
    ADD COLUMN IF NOT EXISTS reward_split_pct integer NOT NULL DEFAULT 80;
