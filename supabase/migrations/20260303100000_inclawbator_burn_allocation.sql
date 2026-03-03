ALTER TABLE inclawbator_projects
    ADD COLUMN IF NOT EXISTS burn_tx_hash text,
    ADD COLUMN IF NOT EXISTS allocation_pct integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS burn_amount numeric DEFAULT 0;
