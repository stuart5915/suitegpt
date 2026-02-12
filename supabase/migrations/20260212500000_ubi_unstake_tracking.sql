-- Add active/unstaked_at columns for unstake flow + staker-days tracking

ALTER TABLE inclawbate_ubi_contributions
    ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS unstaked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ubi_contrib_active
    ON inclawbate_ubi_contributions(wallet_address, token) WHERE active = true;
