-- SUITE App Operator System Tables
-- Run this migration to enable the autonomous hiring & app ownership system

-- ══════════════════════════════════════════════════════════════
-- 1. App Operator Applications (from join page)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_operator_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Applicant info
    discord_id TEXT,
    discord_username TEXT,
    email TEXT,
    telegram_id TEXT,
    wallet_address TEXT,

    -- Application details
    preferred_app_slug TEXT,                    -- Which app they want to operate
    motivation TEXT,                            -- Why they want to operate this app
    experience TEXT,                            -- Relevant experience
    hours_per_week INTEGER DEFAULT 10,          -- Commitment level

    -- Status tracking
    status TEXT DEFAULT 'pending',              -- pending, under_review, accepted, rejected
    reviewed_by TEXT,                           -- Admin who reviewed
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,                      -- If rejected, why

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    referral_source TEXT,                       -- How did they find us (hiring ad, etc.)

    CONSTRAINT valid_status CHECK (status IN ('pending', 'under_review', 'accepted', 'rejected'))
);

-- Index for quick status lookups
CREATE INDEX IF NOT EXISTS idx_operator_applications_status ON app_operator_applications(status);
CREATE INDEX IF NOT EXISTS idx_operator_applications_discord ON app_operator_applications(discord_id);

-- ══════════════════════════════════════════════════════════════
-- 2. App Operators (assigned after acceptance)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_operators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Link to app
    app_slug TEXT NOT NULL,                     -- Which app they operate

    -- Operator identity (at least one required)
    user_discord_id TEXT,
    user_telegram_id TEXT,
    user_wallet_address TEXT,
    operator_name TEXT,                         -- Display name

    -- Ownership terms
    ownership_percent DECIMAL DEFAULT 90,       -- 90% to operator, 10% to SUITE
    marketing_budget_monthly INTEGER DEFAULT 10000,  -- Credits per month
    marketing_budget_used INTEGER DEFAULT 0,    -- Track usage

    -- Status
    status TEXT DEFAULT 'active',               -- active, paused, removed
    paused_reason TEXT,
    removed_reason TEXT,

    -- Dates
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    paused_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,

    -- From which application (if any)
    application_id UUID REFERENCES app_operator_applications(id),

    CONSTRAINT valid_operator_status CHECK (status IN ('active', 'paused', 'removed'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_operators_app_slug ON app_operators(app_slug);
CREATE INDEX IF NOT EXISTS idx_operators_discord ON app_operators(user_discord_id);
CREATE INDEX IF NOT EXISTS idx_operators_status ON app_operators(status);

-- Unique constraint: one active operator per app (can have multiple if paused/removed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_active_app
    ON app_operators(app_slug)
    WHERE status = 'active';

-- ══════════════════════════════════════════════════════════════
-- 3. App Revenue Tracking
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_revenue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Which app
    app_slug TEXT NOT NULL,

    -- Revenue details
    amount DECIMAL NOT NULL,                    -- Amount in USD
    currency TEXT DEFAULT 'USD',
    source TEXT NOT NULL,                       -- 'subscription', 'credits', 'purchase', 'ad_revenue'

    -- Optional transaction reference
    transaction_id TEXT,
    customer_id TEXT,

    -- Period tracking (for subscriptions)
    period_start DATE,
    period_end DATE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,

    CONSTRAINT valid_revenue_source CHECK (source IN ('subscription', 'credits', 'purchase', 'ad_revenue', 'other'))
);

-- Indexes for reporting
CREATE INDEX IF NOT EXISTS idx_revenue_app_slug ON app_revenue(app_slug);
CREATE INDEX IF NOT EXISTS idx_revenue_created ON app_revenue(created_at);
CREATE INDEX IF NOT EXISTS idx_revenue_source ON app_revenue(source);

-- ══════════════════════════════════════════════════════════════
-- 4. Operator Earnings (calculated from app_revenue)
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS operator_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Who earned
    operator_id UUID REFERENCES app_operators(id),

    -- What they earned
    amount DECIMAL NOT NULL,                    -- Their share (after split)
    app_slug TEXT NOT NULL,

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Status
    status TEXT DEFAULT 'pending',              -- pending, available, withdrawn, paid

    -- When it becomes available (e.g., 7 day hold)
    available_at TIMESTAMPTZ,

    -- If withdrawn
    withdrawn_at TIMESTAMPTZ,
    withdrawal_method TEXT,                     -- 'wallet', 'credits', 'paypal'
    withdrawal_tx_id TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,

    CONSTRAINT valid_earnings_status CHECK (status IN ('pending', 'available', 'withdrawn', 'paid'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_earnings_operator ON operator_earnings(operator_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON operator_earnings(status);
CREATE INDEX IF NOT EXISTS idx_earnings_period ON operator_earnings(period_start, period_end);

-- ══════════════════════════════════════════════════════════════
-- 5. RLS Policies (Row Level Security)
-- ══════════════════════════════════════════════════════════════

-- Enable RLS
ALTER TABLE app_operator_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_earnings ENABLE ROW LEVEL SECURITY;

-- Applications: Anyone can insert (apply), only admin can read all
CREATE POLICY "Anyone can submit application"
    ON app_operator_applications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can view own applications"
    ON app_operator_applications FOR SELECT
    USING (
        discord_id = current_setting('request.jwt.claims', true)::json->>'discord_id'
        OR telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
        OR auth.role() = 'service_role'
    );

-- Operators: Operators can view their own data
CREATE POLICY "Operators can view own data"
    ON app_operators FOR SELECT
    USING (
        user_discord_id = current_setting('request.jwt.claims', true)::json->>'discord_id'
        OR user_telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
        OR auth.role() = 'service_role'
    );

-- Revenue: Service role only (admin)
CREATE POLICY "Service role can manage revenue"
    ON app_revenue FOR ALL
    USING (auth.role() = 'service_role');

-- Earnings: Operators can view their own
CREATE POLICY "Operators can view own earnings"
    ON operator_earnings FOR SELECT
    USING (
        operator_id IN (
            SELECT id FROM app_operators
            WHERE user_discord_id = current_setting('request.jwt.claims', true)::json->>'discord_id'
            OR user_telegram_id = current_setting('request.jwt.claims', true)::json->>'telegram_id'
        )
        OR auth.role() = 'service_role'
    );

-- ══════════════════════════════════════════════════════════════
-- 6. Helper Functions
-- ══════════════════════════════════════════════════════════════

-- Function to get operator's total earnings
CREATE OR REPLACE FUNCTION get_operator_earnings_summary(p_operator_id UUID)
RETURNS TABLE (
    total_earned DECIMAL,
    total_available DECIMAL,
    total_pending DECIMAL,
    total_withdrawn DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'available' THEN amount ELSE 0 END), 0) as total_available,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending,
        COALESCE(SUM(CASE WHEN status IN ('withdrawn', 'paid') THEN amount ELSE 0 END), 0) as total_withdrawn
    FROM operator_earnings
    WHERE operator_id = p_operator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate revenue split for an app
CREATE OR REPLACE FUNCTION calculate_operator_earnings(
    p_app_slug TEXT,
    p_period_start DATE,
    p_period_end DATE
) RETURNS DECIMAL AS $$
DECLARE
    v_operator RECORD;
    v_total_revenue DECIMAL;
    v_operator_share DECIMAL;
BEGIN
    -- Get active operator for this app
    SELECT * INTO v_operator
    FROM app_operators
    WHERE app_slug = p_app_slug AND status = 'active'
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Calculate total revenue for period
    SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
    FROM app_revenue
    WHERE app_slug = p_app_slug
      AND created_at >= p_period_start
      AND created_at < p_period_end + INTERVAL '1 day';

    -- Calculate operator's share
    v_operator_share := v_total_revenue * (v_operator.ownership_percent / 100);

    -- Insert earnings record if revenue > 0
    IF v_operator_share > 0 THEN
        INSERT INTO operator_earnings (operator_id, amount, app_slug, period_start, period_end, available_at)
        VALUES (v_operator.id, v_operator_share, p_app_slug, p_period_start, p_period_end, NOW() + INTERVAL '7 days');
    END IF;

    RETURN v_operator_share;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- 7. Update apps table to mark operator availability
-- ══════════════════════════════════════════════════════════════

-- Add operator_needed column to apps if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'operator_needed'
    ) THEN
        ALTER TABLE apps ADD COLUMN operator_needed BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add operator assignment status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'has_operator'
    ) THEN
        ALTER TABLE apps ADD COLUMN has_operator BOOLEAN DEFAULT false;
    END IF;
END $$;

COMMENT ON TABLE app_operator_applications IS 'Applications from people who want to become SUITE app operators';
COMMENT ON TABLE app_operators IS 'Assigned operators for SUITE apps with ownership terms';
COMMENT ON TABLE app_revenue IS 'Revenue tracking for each app in the ecosystem';
COMMENT ON TABLE operator_earnings IS 'Calculated earnings for operators based on revenue share';
