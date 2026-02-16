-- Split total_distributed into per-token columns
-- First 2 distros were CLAWNCH, now switched to inCLAWNCH.
-- Different token prices require separate tracking for accurate USD.

ALTER TABLE inclawbate_ubi_treasury
  ADD COLUMN IF NOT EXISTS total_distributed_clawnch numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_distributed_inclawnch numeric DEFAULT 0;
