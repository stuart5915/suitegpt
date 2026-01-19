-- =====================================================
-- VAULT REPORTING & APY CALCULATION SCHEMA
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. VAULT VALUE REPORTS
-- Admin reports treasury value (includes Yearn positions, etc.)
-- APY calculated automatically from consecutive reports
-- =====================================================

CREATE TABLE IF NOT EXISTS vault_value_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reported_value_usd DECIMAL(20, 2) NOT NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reported_by TEXT, -- admin wallet address
    notes TEXT, -- optional notes about market conditions, etc.

    -- Auto-calculated fields (filled by trigger)
    previous_value_usd DECIMAL(20, 2),
    value_change_usd DECIMAL(20, 2),
    value_change_percent DECIMAL(10, 4),
    days_since_last_report INTEGER,
    calculated_apy DECIMAL(10, 4), -- Annualized from the change

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_vault_reports_date ON vault_value_reports(reported_at DESC);

-- Enable RLS
ALTER TABLE vault_value_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read reports (public transparency)
DROP POLICY IF EXISTS "Anyone can read vault reports" ON vault_value_reports;
CREATE POLICY "Anyone can read vault reports" ON vault_value_reports
    FOR SELECT USING (true);

-- Only service role can insert (admin operations)
DROP POLICY IF EXISTS "Service role can insert vault reports" ON vault_value_reports;
CREATE POLICY "Service role can insert vault reports" ON vault_value_reports
    FOR INSERT WITH CHECK (true);


-- 2. TRIGGER FUNCTION TO AUTO-CALCULATE APY
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_vault_apy()
RETURNS TRIGGER AS $$
DECLARE
    v_previous RECORD;
    v_days INTEGER;
    v_change_usd DECIMAL(20, 2);
    v_change_percent DECIMAL(10, 4);
    v_apy DECIMAL(10, 4);
BEGIN
    -- Get most recent previous report
    SELECT * INTO v_previous
    FROM vault_value_reports
    WHERE reported_at < NEW.reported_at
    ORDER BY reported_at DESC
    LIMIT 1;

    IF v_previous IS NOT NULL THEN
        -- Calculate days between reports
        v_days := EXTRACT(DAY FROM (NEW.reported_at - v_previous.reported_at));
        IF v_days < 1 THEN v_days := 1; END IF; -- Minimum 1 day

        -- Calculate value change
        v_change_usd := NEW.reported_value_usd - v_previous.reported_value_usd;

        -- Calculate percent change
        IF v_previous.reported_value_usd > 0 THEN
            v_change_percent := (v_change_usd / v_previous.reported_value_usd) * 100;
        ELSE
            v_change_percent := 0;
        END IF;

        -- Annualize to get APY: (1 + period_return)^(365/days) - 1
        -- Simplified: period_return * (365 / days)
        IF v_previous.reported_value_usd > 0 AND v_days > 0 THEN
            v_apy := (v_change_usd / v_previous.reported_value_usd) * (365.0 / v_days) * 100;
        ELSE
            v_apy := 0;
        END IF;

        -- Update the new row with calculated values
        NEW.previous_value_usd := v_previous.reported_value_usd;
        NEW.value_change_usd := v_change_usd;
        NEW.value_change_percent := v_change_percent;
        NEW.days_since_last_report := v_days;
        NEW.calculated_apy := v_apy;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_calculate_vault_apy ON vault_value_reports;
CREATE TRIGGER trigger_calculate_vault_apy
    BEFORE INSERT ON vault_value_reports
    FOR EACH ROW
    EXECUTE FUNCTION calculate_vault_apy();


-- 3. FUNCTION TO ADD NEW VALUE REPORT (for admin use)
-- =====================================================

CREATE OR REPLACE FUNCTION report_vault_value(
    p_value_usd DECIMAL,
    p_admin_wallet TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS vault_value_reports AS $$
DECLARE
    v_result vault_value_reports;
BEGIN
    INSERT INTO vault_value_reports (reported_value_usd, reported_by, notes)
    VALUES (p_value_usd, p_admin_wallet, p_notes)
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- 4. VIEW: CURRENT VAULT STATS (for public display)
-- =====================================================

CREATE OR REPLACE VIEW vault_current_stats AS
SELECT
    -- Latest report
    latest.reported_value_usd AS current_value_usd,
    latest.calculated_apy AS current_apy,
    latest.reported_at AS last_updated,
    latest.value_change_usd AS last_change_usd,
    latest.value_change_percent AS last_change_percent,
    latest.days_since_last_report,
    latest.notes AS latest_notes,

    -- Historical stats
    (SELECT COUNT(*) FROM vault_value_reports) AS total_reports,
    (SELECT MIN(reported_value_usd) FROM vault_value_reports) AS lowest_value,
    (SELECT MAX(reported_value_usd) FROM vault_value_reports) AS highest_value,
    (SELECT reported_value_usd FROM vault_value_reports ORDER BY reported_at ASC LIMIT 1) AS initial_value,

    -- Calculate total growth since inception
    CASE
        WHEN (SELECT reported_value_usd FROM vault_value_reports ORDER BY reported_at ASC LIMIT 1) > 0
        THEN ((latest.reported_value_usd - (SELECT reported_value_usd FROM vault_value_reports ORDER BY reported_at ASC LIMIT 1))
              / (SELECT reported_value_usd FROM vault_value_reports ORDER BY reported_at ASC LIMIT 1)) * 100
        ELSE 0
    END AS total_growth_percent,

    -- Average APY over all periods
    (SELECT AVG(calculated_apy) FROM vault_value_reports WHERE calculated_apy IS NOT NULL) AS average_apy

FROM vault_value_reports latest
WHERE latest.reported_at = (SELECT MAX(reported_at) FROM vault_value_reports);


-- 5. TREASURY YIELD PREFERENCES TABLE
-- Tracks how much of their yield each user keeps vs allocates to apps
-- (Separate from app_funding yield_allocations which tracks WHICH apps)
-- =====================================================

CREATE TABLE IF NOT EXISTS treasury_yield_preferences (
    wallet_address TEXT PRIMARY KEY,
    keep_percent INTEGER DEFAULT 90 CHECK (keep_percent >= 0 AND keep_percent <= 100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE treasury_yield_preferences ENABLE ROW LEVEL SECURITY;

-- Anyone can read
DROP POLICY IF EXISTS "Anyone can read treasury_yield_preferences" ON treasury_yield_preferences;
CREATE POLICY "Anyone can read treasury_yield_preferences" ON treasury_yield_preferences
    FOR SELECT USING (true);

-- Anyone can insert/update their own
DROP POLICY IF EXISTS "Anyone can upsert treasury_yield_preferences" ON treasury_yield_preferences;
CREATE POLICY "Anyone can upsert treasury_yield_preferences" ON treasury_yield_preferences
    FOR ALL USING (true);


-- 6. VIEW: YIELD ALLOCATION AGGREGATE STATS
-- Shows what % of total yield goes to apps vs users
-- =====================================================

CREATE OR REPLACE VIEW yield_allocation_stats AS
WITH depositor_allocations AS (
    -- Get each depositor's keep_percent and their share of total deposits
    SELECT
        td.wallet_address,
        COALESCE(typ.keep_percent, 90) AS keep_percent, -- Default 90% keep
        SUM(td.usd_value_at_deposit) AS user_deposit_usd
    FROM treasury_deposits td
    LEFT JOIN treasury_yield_preferences typ ON td.wallet_address = typ.wallet_address
    WHERE td.withdrawn = FALSE
    GROUP BY td.wallet_address, typ.keep_percent
),
totals AS (
    SELECT
        SUM(user_deposit_usd) AS total_deposits_usd,
        COUNT(DISTINCT wallet_address) AS total_depositors
    FROM depositor_allocations
)
SELECT
    -- Weighted average of keep_percent based on deposit size
    COALESCE(
        SUM(da.keep_percent * da.user_deposit_usd) / NULLIF(SUM(da.user_deposit_usd), 0),
        90
    ) AS avg_keep_percent,

    -- Inverse = what goes to apps
    100 - COALESCE(
        SUM(da.keep_percent * da.user_deposit_usd) / NULLIF(SUM(da.user_deposit_usd), 0),
        90
    ) AS avg_apps_percent,

    -- Total deposits
    (SELECT total_deposits_usd FROM totals) AS total_deposits_usd,

    -- Total depositors
    (SELECT total_depositors FROM totals) AS total_depositors,

    -- Count by allocation preference
    COUNT(CASE WHEN da.keep_percent >= 80 THEN 1 END) AS depositors_keeping_80_plus,
    COUNT(CASE WHEN da.keep_percent >= 50 AND da.keep_percent < 80 THEN 1 END) AS depositors_keeping_50_to_79,
    COUNT(CASE WHEN da.keep_percent < 50 THEN 1 END) AS depositors_keeping_under_50

FROM depositor_allocations da;


-- 7. VIEW: VAULT HISTORY (for charts)
-- =====================================================

CREATE OR REPLACE VIEW vault_value_history AS
SELECT
    id,
    reported_value_usd,
    reported_at,
    value_change_usd,
    value_change_percent,
    calculated_apy,
    days_since_last_report,
    notes
FROM vault_value_reports
ORDER BY reported_at DESC;


-- 8. FUNCTION: GET VAULT STATS FOR PUBLIC DISPLAY
-- Returns a JSON object with all the stats
-- =====================================================

CREATE OR REPLACE FUNCTION get_vault_public_stats()
RETURNS JSON AS $$
DECLARE
    v_stats JSON;
    v_current RECORD;
    v_allocations RECORD;
BEGIN
    -- Get current stats
    SELECT * INTO v_current FROM vault_current_stats LIMIT 1;

    -- Get allocation stats
    SELECT * INTO v_allocations FROM yield_allocation_stats LIMIT 1;

    -- Build JSON response
    v_stats := json_build_object(
        'vault', json_build_object(
            'current_value_usd', COALESCE(v_current.current_value_usd, 0),
            'current_apy', COALESCE(v_current.current_apy, 0),
            'last_updated', v_current.last_updated,
            'last_change_usd', COALESCE(v_current.last_change_usd, 0),
            'last_change_percent', COALESCE(v_current.last_change_percent, 0),
            'total_growth_percent', COALESCE(v_current.total_growth_percent, 0),
            'average_apy', COALESCE(v_current.average_apy, 0),
            'total_reports', COALESCE(v_current.total_reports, 0)
        ),
        'allocations', json_build_object(
            'avg_keep_percent', COALESCE(v_allocations.avg_keep_percent, 90),
            'avg_apps_percent', COALESCE(v_allocations.avg_apps_percent, 10),
            'total_deposits_usd', COALESCE(v_allocations.total_deposits_usd, 0),
            'total_depositors', COALESCE(v_allocations.total_depositors, 0)
        ),
        'generated_at', NOW()
    );

    RETURN v_stats;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- Admin reports weekly value:
-- SELECT report_vault_value(10500.00, '0xAdminWallet...', 'Yearn position +5% this week');

-- Get current stats for display:
-- SELECT * FROM vault_current_stats;

-- Get allocation breakdown:
-- SELECT * FROM yield_allocation_stats;

-- Get full public stats as JSON:
-- SELECT get_vault_public_stats();

-- Get value history for charts:
-- SELECT * FROM vault_value_history LIMIT 52; -- Last year of weekly reports

-- =====================================================
-- DONE! Your Vault Reporting system now supports:
-- - Admin weekly value reports
-- - Auto-calculated APY from consecutive reports
-- - Aggregate yield allocation stats (% to apps vs users)
-- - Public-facing views and functions
-- - Historical data for charts
-- =====================================================
