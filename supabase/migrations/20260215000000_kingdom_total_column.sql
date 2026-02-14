ALTER TABLE inclawbate_ubi_treasury
    ADD COLUMN IF NOT EXISTS kingdom_total_distributed numeric DEFAULT 0;
