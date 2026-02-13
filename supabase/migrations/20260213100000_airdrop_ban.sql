ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS airdrop_banned boolean NOT NULL DEFAULT false;
