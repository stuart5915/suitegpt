-- Add withdrawal tracking columns for unstake returns
ALTER TABLE inclawbate_ubi_contributions
    ADD COLUMN IF NOT EXISTS withdrawal_status text,
    ADD COLUMN IF NOT EXISTS withdrawal_tx text;

-- Index for filtering pending withdrawals
CREATE INDEX IF NOT EXISTS idx_ubi_contrib_withdrawal
    ON inclawbate_ubi_contributions(withdrawal_status)
    WHERE active = false AND unstaked_at IS NOT NULL;
