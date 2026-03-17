-- Add account column to support @inclawbator and @inclawbate schedules
ALTER TABLE agent_schedule ADD COLUMN IF NOT EXISTS account text NOT NULL DEFAULT 'inclawbator';

-- Drop the old unique constraint (was only on scheduled_at)
DROP INDEX IF EXISTS idx_schedule_unique_slot;

-- Recreate: unique per account+time (cancelled/failed slots don't block)
CREATE UNIQUE INDEX idx_schedule_unique_slot
    ON agent_schedule(account, scheduled_at) WHERE status = 'scheduled';

-- Index for filtering by account
CREATE INDEX IF NOT EXISTS idx_schedule_account ON agent_schedule(account);
