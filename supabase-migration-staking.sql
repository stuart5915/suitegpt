-- ============================================================
-- SUITE App Staking Schema Migration
-- Created: 2026-01-15
-- Purpose: Track on-chain staking allocations for app tier system
-- ============================================================

-- 1. Create app_stakes table to cache on-chain data
CREATE TABLE IF NOT EXISTS app_stakes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    staker_address TEXT NOT NULL,
    amount_staked DECIMAL NOT NULL DEFAULT 0,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_app_stakes_app ON app_stakes(app_id);
CREATE INDEX IF NOT EXISTS idx_app_stakes_staker ON app_stakes(staker_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_stakes_unique ON app_stakes(app_id, staker_address);

-- 2. Add staking columns to apps table
ALTER TABLE apps ADD COLUMN IF NOT EXISTS total_staked DECIMAL DEFAULT 0;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS current_tier INTEGER DEFAULT 0;

-- 3. Enable RLS (Row Level Security)
ALTER TABLE app_stakes ENABLE ROW LEVEL SECURITY;

-- Public read access for stakes (transparency)
CREATE POLICY "Public read access for stakes" ON app_stakes
    FOR SELECT USING (true);

-- Only service role can insert/update (synced from chain)
CREATE POLICY "Service role insert" ON app_stakes
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role update" ON app_stakes
    FOR UPDATE USING (auth.role() = 'service_role');

-- 4. Function to update app totals when stakes change
CREATE OR REPLACE FUNCTION update_app_stake_totals()
RETURNS TRIGGER AS $$
DECLARE
    new_total DECIMAL;
    new_tier INTEGER;
BEGIN
    -- Calculate new total for the app
    SELECT COALESCE(SUM(amount_staked), 0) INTO new_total
    FROM app_stakes
    WHERE app_id = COALESCE(NEW.app_id, OLD.app_id);
    
    -- Calculate tier based on thresholds
    -- Tier 1: 10,000 SUITE, Tier 2: 50,000, Tier 3: 200,000, Tier 4: 500,000, Tier 5: 1,000,000
    new_tier := CASE
        WHEN new_total >= 1000000 THEN 5
        WHEN new_total >= 500000 THEN 4
        WHEN new_total >= 200000 THEN 3
        WHEN new_total >= 50000 THEN 2
        WHEN new_total >= 10000 THEN 1
        ELSE 0
    END;
    
    -- Update the apps table
    UPDATE apps 
    SET total_staked = new_total, current_tier = new_tier
    WHERE id = COALESCE(NEW.app_id, OLD.app_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger to auto-update totals
DROP TRIGGER IF EXISTS trg_update_app_stake_totals ON app_stakes;
CREATE TRIGGER trg_update_app_stake_totals
    AFTER INSERT OR UPDATE OR DELETE ON app_stakes
    FOR EACH ROW
    EXECUTE FUNCTION update_app_stake_totals();

-- 6. View for app leaderboard with stake info
CREATE OR REPLACE VIEW app_stake_leaderboard AS
SELECT 
    a.id,
    a.name,
    a.slug,
    a.icon_url,
    COALESCE(a.total_staked, 0) as total_staked,
    COALESCE(a.current_tier, 0) as current_tier,
    COUNT(DISTINCT s.staker_address) as staker_count,
    -- Progress to next tier
    CASE 
        WHEN a.current_tier >= 5 THEN 100
        WHEN a.current_tier = 4 THEN ((a.total_staked - 500000) / 500000.0 * 100)::INTEGER
        WHEN a.current_tier = 3 THEN ((a.total_staked - 200000) / 300000.0 * 100)::INTEGER
        WHEN a.current_tier = 2 THEN ((a.total_staked - 50000) / 150000.0 * 100)::INTEGER
        WHEN a.current_tier = 1 THEN ((a.total_staked - 10000) / 40000.0 * 100)::INTEGER
        ELSE (a.total_staked / 10000.0 * 100)::INTEGER
    END as progress_to_next
FROM apps a
LEFT JOIN app_stakes s ON a.id = s.app_id
GROUP BY a.id, a.name, a.slug, a.icon_url, a.total_staked, a.current_tier
ORDER BY total_staked DESC;

-- Done!
-- Run this in Supabase SQL Editor to set up the staking tables
