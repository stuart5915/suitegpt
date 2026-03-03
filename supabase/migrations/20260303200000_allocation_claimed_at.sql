ALTER TABLE inclawbator_projects
    ADD COLUMN IF NOT EXISTS allocation_claimed_at timestamptz;
