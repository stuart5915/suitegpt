-- Add socials column to UBI requests for identity verification
ALTER TABLE inclawbate_ubi_requests
    ADD COLUMN IF NOT EXISTS socials jsonb DEFAULT NULL;
