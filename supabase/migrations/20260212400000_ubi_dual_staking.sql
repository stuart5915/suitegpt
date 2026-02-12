-- Add dual staking support: inCLAWNCH staking + token tracking on contributions
ALTER TABLE inclawbate_ubi_treasury
    ADD COLUMN IF NOT EXISTS inclawnch_staked numeric NOT NULL DEFAULT 0;

ALTER TABLE inclawbate_ubi_contributions
    ADD COLUMN IF NOT EXISTS token text NOT NULL DEFAULT 'clawnch';

CREATE INDEX IF NOT EXISTS idx_ubi_contrib_token ON inclawbate_ubi_contributions(token);
