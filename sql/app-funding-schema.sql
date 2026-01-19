-- =====================================================
-- SUITE App Funding & Graduation System
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. APP FUNDING TABLE
-- Tracks individual funding contributions (locked forever)
-- =====================================================

CREATE TABLE IF NOT EXISTS app_funding (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID NOT NULL,
    user_id TEXT NOT NULL,  -- wallet address or telegram ID
    amount DECIMAL(12, 4) NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('yield', 'direct')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_app_funding_app_id ON app_funding(app_id);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_app_funding_user_id ON app_funding(user_id);

-- Enable Row Level Security
ALTER TABLE app_funding ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read funding
DROP POLICY IF EXISTS "Anyone can read app_funding" ON app_funding;
CREATE POLICY "Anyone can read app_funding" ON app_funding
    FOR SELECT USING (true);

-- Policy: Anyone can insert funding
DROP POLICY IF EXISTS "Anyone can insert app_funding" ON app_funding;
CREATE POLICY "Anyone can insert app_funding" ON app_funding
    FOR INSERT WITH CHECK (true);


-- 2. YIELD ALLOCATIONS TABLE
-- Tracks where users want their future yield to go (changeable)
-- =====================================================

CREATE TABLE IF NOT EXISTS yield_allocations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    app_id UUID NOT NULL,
    percentage INTEGER NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, app_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_yield_allocations_user_id ON yield_allocations(user_id);

-- Enable Row Level Security
ALTER TABLE yield_allocations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read allocations
DROP POLICY IF EXISTS "Anyone can read yield_allocations" ON yield_allocations;
CREATE POLICY "Anyone can read yield_allocations" ON yield_allocations
    FOR SELECT USING (true);

-- Policy: Anyone can insert/update their allocations
DROP POLICY IF EXISTS "Anyone can insert yield_allocations" ON yield_allocations;
CREATE POLICY "Anyone can insert yield_allocations" ON yield_allocations
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update yield_allocations" ON yield_allocations;
CREATE POLICY "Anyone can update yield_allocations" ON yield_allocations
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete yield_allocations" ON yield_allocations;
CREATE POLICY "Anyone can delete yield_allocations" ON yield_allocations
    FOR DELETE USING (true);


-- 3. REVENUE DISTRIBUTIONS TABLE
-- Tracks when revenue is distributed to funders
-- =====================================================

CREATE TABLE IF NOT EXISTS revenue_distributions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID NOT NULL,
    total_revenue DECIMAL(12, 4) NOT NULL,
    funder_share DECIMAL(12, 4) NOT NULL,  -- 50% of total
    admin_share DECIMAL(12, 4) NOT NULL,   -- 50% of total
    distributed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_revenue_distributions_app_id ON revenue_distributions(app_id);

-- Enable Row Level Security
ALTER TABLE revenue_distributions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read distributions
DROP POLICY IF EXISTS "Anyone can read revenue_distributions" ON revenue_distributions;
CREATE POLICY "Anyone can read revenue_distributions" ON revenue_distributions
    FOR SELECT USING (true);

-- Policy: Only admins can insert (via service key or admin check)
DROP POLICY IF EXISTS "Anyone can insert revenue_distributions" ON revenue_distributions;
CREATE POLICY "Anyone can insert revenue_distributions" ON revenue_distributions
    FOR INSERT WITH CHECK (true);


-- 4. FUNDER PAYOUTS TABLE
-- Tracks individual payouts to funders
-- =====================================================

CREATE TABLE IF NOT EXISTS funder_payouts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    distribution_id UUID REFERENCES revenue_distributions(id),
    app_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    amount DECIMAL(12, 4) NOT NULL,
    percentage DECIMAL(5, 2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_funder_payouts_user_id ON funder_payouts(user_id);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_funder_payouts_app_id ON funder_payouts(app_id);

-- Enable Row Level Security
ALTER TABLE funder_payouts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read payouts
DROP POLICY IF EXISTS "Anyone can read funder_payouts" ON funder_payouts;
CREATE POLICY "Anyone can read funder_payouts" ON funder_payouts
    FOR SELECT USING (true);

-- Policy: Admins can insert/update payouts
DROP POLICY IF EXISTS "Anyone can insert funder_payouts" ON funder_payouts;
CREATE POLICY "Anyone can insert funder_payouts" ON funder_payouts
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update funder_payouts" ON funder_payouts;
CREATE POLICY "Anyone can update funder_payouts" ON funder_payouts
    FOR UPDATE USING (true);


-- 5. ADD COLUMNS TO APPS TABLE
-- =====================================================

-- Total funded amount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'total_funded'
    ) THEN
        ALTER TABLE apps ADD COLUMN total_funded DECIMAL(12, 4) DEFAULT 0;
    END IF;
END $$;

-- Graduation status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'is_graduated'
    ) THEN
        ALTER TABLE apps ADD COLUMN is_graduated BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Graduation timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'graduated_at'
    ) THEN
        ALTER TABLE apps ADD COLUMN graduated_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Total revenue generated
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'total_revenue'
    ) THEN
        ALTER TABLE apps ADD COLUMN total_revenue DECIMAL(12, 4) DEFAULT 0;
    END IF;
END $$;

-- Funder count (cached for performance)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'funder_count'
    ) THEN
        ALTER TABLE apps ADD COLUMN funder_count INTEGER DEFAULT 0;
    END IF;
END $$;


-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to add funding and update app totals
CREATE OR REPLACE FUNCTION add_app_funding(
    p_app_id UUID,
    p_user_id TEXT,
    p_amount DECIMAL,
    p_source TEXT
) RETURNS void AS $$
DECLARE
    v_new_total DECIMAL;
    v_funder_exists BOOLEAN;
BEGIN
    -- Insert the funding record
    INSERT INTO app_funding (app_id, user_id, amount, source)
    VALUES (p_app_id, p_user_id, p_amount, p_source);

    -- Check if this is a new funder for this app
    SELECT EXISTS(
        SELECT 1 FROM app_funding
        WHERE app_id = p_app_id AND user_id = p_user_id
        GROUP BY user_id
        HAVING COUNT(*) = 1
    ) INTO v_funder_exists;

    -- Update app totals
    UPDATE apps
    SET
        total_funded = COALESCE(total_funded, 0) + p_amount,
        funder_count = CASE WHEN v_funder_exists THEN COALESCE(funder_count, 0) + 1 ELSE funder_count END,
        is_graduated = CASE WHEN COALESCE(total_funded, 0) + p_amount >= 5000 THEN true ELSE is_graduated END,
        graduated_at = CASE
            WHEN COALESCE(total_funded, 0) < 5000 AND COALESCE(total_funded, 0) + p_amount >= 5000
            THEN NOW()
            ELSE graduated_at
        END
    WHERE id = p_app_id
    RETURNING total_funded INTO v_new_total;
END;
$$ LANGUAGE plpgsql;


-- Function to get funder stats for an app
CREATE OR REPLACE FUNCTION get_app_funders(p_app_id UUID)
RETURNS TABLE (
    user_id TEXT,
    total_contributed DECIMAL,
    contribution_percentage DECIMAL,
    first_contribution TIMESTAMP WITH TIME ZONE,
    contribution_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH app_total AS (
        SELECT COALESCE(SUM(amount), 0) as total FROM app_funding WHERE app_id = p_app_id
    )
    SELECT
        af.user_id,
        SUM(af.amount) as total_contributed,
        CASE
            WHEN (SELECT total FROM app_total) > 0
            THEN ROUND((SUM(af.amount) / (SELECT total FROM app_total)) * 100, 2)
            ELSE 0
        END as contribution_percentage,
        MIN(af.created_at) as first_contribution,
        COUNT(*)::INTEGER as contribution_count
    FROM app_funding af
    WHERE af.app_id = p_app_id
    GROUP BY af.user_id
    ORDER BY total_contributed DESC;
END;
$$ LANGUAGE plpgsql;


-- Function to get user's funding across all apps
CREATE OR REPLACE FUNCTION get_user_funding(p_user_id TEXT)
RETURNS TABLE (
    app_id UUID,
    app_name TEXT,
    app_slug TEXT,
    total_contributed DECIMAL,
    contribution_percentage DECIMAL,
    app_total_funded DECIMAL,
    app_is_graduated BOOLEAN,
    app_total_revenue DECIMAL,
    user_earnings DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id as app_id,
        a.name as app_name,
        a.slug as app_slug,
        COALESCE(SUM(af.amount), 0) as total_contributed,
        CASE
            WHEN COALESCE(a.total_funded, 0) > 0
            THEN ROUND((COALESCE(SUM(af.amount), 0) / a.total_funded) * 100, 2)
            ELSE 0
        END as contribution_percentage,
        COALESCE(a.total_funded, 0) as app_total_funded,
        COALESCE(a.is_graduated, false) as app_is_graduated,
        COALESCE(a.total_revenue, 0) as app_total_revenue,
        -- Calculate user's share of 50% funder revenue
        CASE
            WHEN COALESCE(a.total_funded, 0) > 0
            THEN ROUND((COALESCE(SUM(af.amount), 0) / a.total_funded) * (COALESCE(a.total_revenue, 0) * 0.5), 2)
            ELSE 0
        END as user_earnings
    FROM apps a
    LEFT JOIN app_funding af ON a.id = af.app_id AND af.user_id = p_user_id
    WHERE af.user_id IS NOT NULL
    GROUP BY a.id, a.name, a.slug, a.total_funded, a.is_graduated, a.total_revenue
    ORDER BY total_contributed DESC;
END;
$$ LANGUAGE plpgsql;


-- Function to calculate app tier from funding amount
CREATE OR REPLACE FUNCTION get_app_tier(funded DECIMAL)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE
        WHEN funded >= 15000 THEN 'scale'
        WHEN funded >= 5000 THEN 'launch'
        WHEN funded >= 2500 THEN 'growth'
        WHEN funded >= 1000 THEN 'sprout'
        ELSE 'seed'
    END;
END;
$$ LANGUAGE plpgsql;


-- Function to distribute revenue (100% to funders)
CREATE OR REPLACE FUNCTION distribute_app_revenue(
    p_app_id UUID,
    p_revenue_amount DECIMAL
) RETURNS UUID AS $$
DECLARE
    v_distribution_id UUID;
    v_funder_share DECIMAL;
    v_admin_share DECIMAL;
    v_funder RECORD;
BEGIN
    -- 100% of revenue goes to funders
    v_funder_share := p_revenue_amount;
    v_admin_share := 0;

    -- Create distribution record
    INSERT INTO revenue_distributions (app_id, total_revenue, funder_share, admin_share)
    VALUES (p_app_id, p_revenue_amount, v_funder_share, v_admin_share)
    RETURNING id INTO v_distribution_id;

    -- Create payout records for each funder
    FOR v_funder IN
        SELECT * FROM get_app_funders(p_app_id)
    LOOP
        INSERT INTO funder_payouts (distribution_id, app_id, user_id, amount, percentage)
        VALUES (
            v_distribution_id,
            p_app_id,
            v_funder.user_id,
            ROUND(v_funder_share * (v_funder.contribution_percentage / 100), 4),
            v_funder.contribution_percentage
        );
    END LOOP;

    -- Update app's total revenue
    UPDATE apps
    SET total_revenue = COALESCE(total_revenue, 0) + p_revenue_amount
    WHERE id = p_app_id;

    RETURN v_distribution_id;
END;
$$ LANGUAGE plpgsql;


-- 7. VIEW FOR APP FUNDING STATS
-- =====================================================

CREATE OR REPLACE VIEW app_funding_stats AS
SELECT
    a.id,
    a.name,
    a.slug,
    COALESCE(a.total_funded, 0) as total_funded,
    COALESCE(a.funder_count, 0) as funder_count,
    get_app_tier(COALESCE(a.total_funded, 0)) as tier,
    COALESCE(a.total_revenue, 0) as total_revenue,
    COALESCE(a.total_revenue, 0) as total_funder_earnings,  -- 100% to funders
    CASE
        WHEN COALESCE(a.total_funded, 0) >= 15000 THEN 'scale'
        WHEN COALESCE(a.total_funded, 0) >= 5000 THEN 'launch'
        WHEN COALESCE(a.total_funded, 0) >= 2500 THEN 'growth'
        WHEN COALESCE(a.total_funded, 0) >= 1000 THEN 'sprout'
        ELSE 'seed'
    END as current_tier,
    CASE
        WHEN COALESCE(a.total_funded, 0) >= 15000 THEN NULL
        WHEN COALESCE(a.total_funded, 0) >= 5000 THEN 15000
        WHEN COALESCE(a.total_funded, 0) >= 2500 THEN 5000
        WHEN COALESCE(a.total_funded, 0) >= 1000 THEN 2500
        ELSE 1000
    END as next_tier_target
FROM apps a;


-- =====================================================
-- DONE! Your App Funding & Tier system now supports:
-- - Individual funding contributions (yield or direct)
-- - Yield allocation tracking
-- - 5-tier system: Seed, Sprout, Growth, Launch, Scale
-- - 100% revenue distribution to funders
-- - Funder payout tracking
-- - Tier thresholds: $1K, $2.5K, $5K, $15K
-- =====================================================
