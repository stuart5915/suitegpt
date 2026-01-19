-- Migration: Enable Dynamic Destinations in NoteBox
-- This removes the hardcoded status constraint to allow any destination

-- 1. Drop the old status constraint
ALTER TABLE personal_ideas DROP CONSTRAINT IF EXISTS personal_ideas_status_check;

-- 2. Add destination_slug column for better tracking
ALTER TABLE personal_ideas ADD COLUMN IF NOT EXISTS destination_slug TEXT;

-- 3. Create index for destination lookups
CREATE INDEX IF NOT EXISTS idx_personal_ideas_destination ON personal_ideas(destination_slug);

-- 4. Update existing items to have destination_slug based on status
UPDATE personal_ideas SET destination_slug = 'stuart' WHERE status = 'inbox' AND destination_slug IS NULL;
UPDATE personal_ideas SET destination_slug = 'suite' WHERE status = 'pushed' AND destination_slug IS NULL;
UPDATE personal_ideas SET destination_slug = 'artstu' WHERE status = 'artstu' AND destination_slug IS NULL;

-- 5. For new destinations, items will have:
--    - status: 'inbox' (active) or 'dismissed'/'implemented' (archived)
--    - destination_slug: the destination they belong to

-- Note: The bot will now set destination_slug when creating items
