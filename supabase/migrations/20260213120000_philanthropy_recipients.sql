-- Add philanthropy recipient support to human_profiles
ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS is_philanthropy_recipient boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS philanthropy_note text;
