-- Track cumulative USD value at time of each distribution (locked-in, not repriced)
ALTER TABLE inclawbate_ubi_treasury
ADD COLUMN IF NOT EXISTS total_distributed_usd numeric NOT NULL DEFAULT 0;

-- Seed with historical value for distros 1-5
-- Distros 1-4: ~$2,900 (confirmed from Feb 16 post)
-- Distro 5: 200M inCLAWNCH × ~$0.00000126 = ~$252
UPDATE inclawbate_ubi_treasury SET total_distributed_usd = 3150 WHERE id = 1;
