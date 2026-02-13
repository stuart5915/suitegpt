ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS ubi_total_received numeric NOT NULL DEFAULT 0;
