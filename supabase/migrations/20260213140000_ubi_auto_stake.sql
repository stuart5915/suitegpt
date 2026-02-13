ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS ubi_auto_stake boolean NOT NULL DEFAULT false;
