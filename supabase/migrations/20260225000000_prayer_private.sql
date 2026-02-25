-- Add private prayer support
ALTER TABLE prayer_requests ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_prayer_requests_private ON prayer_requests(is_private);
