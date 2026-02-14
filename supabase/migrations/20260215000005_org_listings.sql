-- Add columns for paid org listings
ALTER TABLE inclawbate_philanthropy_orgs
    ADD COLUMN IF NOT EXISTS submitted_by text,
    ADD COLUMN IF NOT EXISTS tx_hash text,
    ADD COLUMN IF NOT EXISTS tagline text,
    ADD COLUMN IF NOT EXISTS icon_emoji text;

-- Backfill E3 Ministry
UPDATE inclawbate_philanthropy_orgs SET tagline = 'Equip · Evangelize · Establish', icon_emoji = '⛪' WHERE id = 1;
