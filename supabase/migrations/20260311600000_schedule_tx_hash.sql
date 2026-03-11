-- Add tx_hash to agent_schedule for on-chain payment verification
ALTER TABLE agent_schedule ADD COLUMN IF NOT EXISTS tx_hash text;

-- Prevent reuse of the same transaction for multiple bookings
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_tx_hash
    ON agent_schedule(tx_hash) WHERE tx_hash IS NOT NULL;
