-- Add split percentage columns for custom energy distribution
ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS ubi_split_keep_pct integer,
    ADD COLUMN IF NOT EXISTS ubi_split_kingdom_pct integer,
    ADD COLUMN IF NOT EXISTS ubi_split_reinvest_pct integer;
