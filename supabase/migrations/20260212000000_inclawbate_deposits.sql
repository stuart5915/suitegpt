-- Inclawbate deposit tracking
CREATE TABLE inclawbate_deposits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES human_profiles(id) NOT NULL,
    tx_hash text UNIQUE NOT NULL,
    clawnch_amount numeric NOT NULL,
    credits_granted integer NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_deposits_profile ON inclawbate_deposits(profile_id);
CREATE INDEX idx_deposits_tx ON inclawbate_deposits(tx_hash);

-- Leaderboard: track total replies per profile
ALTER TABLE human_profiles ADD COLUMN IF NOT EXISTS total_replies integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_inclawbator_replies(target_profile_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    UPDATE human_profiles SET total_replies = total_replies + 1 WHERE id = target_profile_id;
END; $$;
