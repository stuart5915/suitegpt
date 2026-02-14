-- Add request_type column to distinguish Go CLAWNCH Me (lump sum) from UBI requests (monthly)
ALTER TABLE inclawbate_ubi_requests
    ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'goclawnchme';
