-- Track cumulative USD value at time of each distribution (locked-in, not repriced)
ALTER TABLE inclawbate_ubi_treasury
ADD COLUMN IF NOT EXISTS total_distributed_usd numeric NOT NULL DEFAULT 0;

-- Seed with approximate historical value for distros 1-5
-- First 3 distros: $2,047 actual cost
-- Distros 4-5: ~$883 at distribution-time prices
UPDATE inclawbate_ubi_treasury SET total_distributed_usd = 2930 WHERE id = 1;
