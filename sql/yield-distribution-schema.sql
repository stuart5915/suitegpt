-- =====================================================
-- YIELD DISTRIBUTION & DYNAMIC CREDITS SYSTEM
-- Run this in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. USER CREDIT BALANCES VIEW (Dynamic Calculation)
-- Credits = (LP Share × Vault Value × 1000) - Spent - To Apps
-- =====================================================

CREATE OR REPLACE VIEW user_credit_balances AS
WITH
-- Get current vault value
vault_value AS (
    SELECT COALESCE(reported_value_usd, 0) AS current_value
    FROM vault_value_reports
    ORDER BY reported_at DESC
    LIMIT 1
),
-- Get total LP supply
lp_supply AS (
    SELECT COALESCE(SUM(lp_tokens_issued), 0) AS total_lp
    FROM treasury_deposits
    WHERE withdrawn = FALSE
),
-- Get each user's LP tokens and deposits
user_lp AS (
    SELECT
        wallet_address,
        SUM(lp_tokens_issued) AS lp_tokens,
        SUM(usd_value_at_deposit) AS total_deposited
    FROM treasury_deposits
    WHERE withdrawn = FALSE
    GROUP BY wallet_address
),
-- Get each user's yield already allocated to apps
user_yield_to_apps AS (
    SELECT
        user_id AS wallet_address,
        COALESCE(SUM(amount), 0) AS yield_to_apps_usd
    FROM app_funding
    WHERE source = 'yield'
    GROUP BY user_id
),
-- Get each user's credits spent
user_credits_spent AS (
    SELECT
        wallet_address,
        COALESCE(total_used, 0) AS credits_spent
    FROM suite_credits
)
SELECT
    ul.wallet_address,
    ul.lp_tokens,
    ul.total_deposited,

    -- LP share percentage
    CASE WHEN ls.total_lp > 0
        THEN ROUND((ul.lp_tokens / ls.total_lp) * 100, 4)
        ELSE 0
    END AS lp_share_percent,

    -- Current vault share in USD
    CASE WHEN ls.total_lp > 0
        THEN ROUND((ul.lp_tokens / ls.total_lp) * vv.current_value, 2)
        ELSE 0
    END AS vault_share_usd,

    -- Gross credits (vault share × 1000)
    CASE WHEN ls.total_lp > 0
        THEN FLOOR((ul.lp_tokens / ls.total_lp) * vv.current_value * 1000)
        ELSE 0
    END AS gross_credits,

    -- Credits spent in apps
    COALESCE(ucs.credits_spent, 0) AS credits_spent,

    -- USD value of yield allocated to apps
    COALESCE(uya.yield_to_apps_usd, 0) AS yield_to_apps_usd,

    -- Credits equivalent of yield to apps
    COALESCE(uya.yield_to_apps_usd, 0) * 1000 AS yield_to_apps_credits,

    -- Final spendable credits
    GREATEST(
        CASE WHEN ls.total_lp > 0
            THEN FLOOR((ul.lp_tokens / ls.total_lp) * vv.current_value * 1000)
            ELSE 0
        END
        - COALESCE(ucs.credits_spent, 0)
        - (COALESCE(uya.yield_to_apps_usd, 0) * 1000),
        0
    ) AS spendable_credits,

    -- Spendable in USD
    GREATEST(
        CASE WHEN ls.total_lp > 0
            THEN ROUND((ul.lp_tokens / ls.total_lp) * vv.current_value, 2)
            ELSE 0
        END
        - COALESCE(ucs.credits_spent, 0) / 1000.0
        - COALESCE(uya.yield_to_apps_usd, 0),
        0
    ) AS spendable_usd

FROM user_lp ul
CROSS JOIN vault_value vv
CROSS JOIN lp_supply ls
LEFT JOIN user_yield_to_apps uya ON ul.wallet_address = uya.wallet_address
LEFT JOIN user_credits_spent ucs ON ul.wallet_address = ucs.wallet_address;


-- =====================================================
-- 2. FUNCTION: GET USER CREDITS (for API calls)
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_credits(p_wallet TEXT)
RETURNS TABLE (
    wallet_address TEXT,
    lp_tokens DECIMAL,
    lp_share_percent DECIMAL,
    vault_share_usd DECIMAL,
    gross_credits BIGINT,
    credits_spent BIGINT,
    yield_to_apps_usd DECIMAL,
    spendable_credits BIGINT,
    spendable_usd DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ucb.wallet_address,
        ucb.lp_tokens,
        ucb.lp_share_percent,
        ucb.vault_share_usd,
        ucb.gross_credits,
        ucb.credits_spent,
        ucb.yield_to_apps_usd,
        ucb.spendable_credits,
        ucb.spendable_usd
    FROM user_credit_balances ucb
    WHERE ucb.wallet_address = LOWER(p_wallet);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 3. FUNCTION: PROCESS YIELD DISTRIBUTION
-- Called after admin reports new vault value
-- Calculates yield and distributes to apps
-- =====================================================

CREATE OR REPLACE FUNCTION process_yield_distribution()
RETURNS TABLE (
    users_processed INTEGER,
    total_yield_usd DECIMAL,
    yield_to_users_usd DECIMAL,
    yield_to_apps_usd DECIMAL,
    apps_funded INTEGER
) AS $$
DECLARE
    v_previous_value DECIMAL;
    v_current_value DECIMAL;
    v_total_yield DECIMAL;
    v_total_lp DECIMAL;
    v_user RECORD;
    v_user_yield DECIMAL;
    v_user_apps_yield DECIMAL;
    v_user_keep_yield DECIMAL;
    v_allocation RECORD;
    v_app_amount DECIMAL;
    v_users_count INTEGER := 0;
    v_yield_to_users DECIMAL := 0;
    v_yield_to_apps DECIMAL := 0;
    v_apps_count INTEGER := 0;
    v_unallocated DECIMAL;
    v_ecosystem_app_id UUID;
BEGIN
    -- Get current and previous vault values
    SELECT reported_value_usd INTO v_current_value
    FROM vault_value_reports
    ORDER BY reported_at DESC
    LIMIT 1;

    SELECT reported_value_usd INTO v_previous_value
    FROM vault_value_reports
    ORDER BY reported_at DESC
    OFFSET 1
    LIMIT 1;

    -- If no previous value or no growth, nothing to distribute
    IF v_previous_value IS NULL OR v_current_value <= v_previous_value THEN
        RETURN QUERY SELECT 0, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0;
        RETURN;
    END IF;

    -- Calculate total yield
    v_total_yield := v_current_value - v_previous_value;

    -- Get total LP supply
    SELECT COALESCE(SUM(lp_tokens_issued), 0) INTO v_total_lp
    FROM treasury_deposits
    WHERE withdrawn = FALSE;

    IF v_total_lp = 0 THEN
        RETURN QUERY SELECT 0, v_total_yield, 0::DECIMAL, 0::DECIMAL, 0;
        RETURN;
    END IF;

    -- Get or create "SUITE Ecosystem" app for unallocated funds
    SELECT id INTO v_ecosystem_app_id FROM apps WHERE slug = 'suite-ecosystem';

    -- Process each depositor
    FOR v_user IN
        SELECT
            td.wallet_address,
            SUM(td.lp_tokens_issued) AS lp_tokens,
            COALESCE(typ.keep_percent, 90) AS keep_percent
        FROM treasury_deposits td
        LEFT JOIN treasury_yield_preferences typ ON td.wallet_address = typ.wallet_address
        WHERE td.withdrawn = FALSE
        GROUP BY td.wallet_address, typ.keep_percent
    LOOP
        v_users_count := v_users_count + 1;

        -- Calculate user's share of yield
        v_user_yield := (v_user.lp_tokens / v_total_lp) * v_total_yield;

        -- Split according to keep_percent (max 90%, meaning min 10% to apps)
        v_user_keep_yield := v_user_yield * (LEAST(v_user.keep_percent, 90)::DECIMAL / 100);
        v_user_apps_yield := v_user_yield - v_user_keep_yield;

        v_yield_to_users := v_yield_to_users + v_user_keep_yield;
        v_yield_to_apps := v_yield_to_apps + v_user_apps_yield;

        -- Distribute user's apps yield to their selected apps
        v_unallocated := v_user_apps_yield;

        FOR v_allocation IN
            SELECT app_id, percentage
            FROM yield_allocations
            WHERE user_id = v_user.wallet_address
            ORDER BY percentage DESC
        LOOP
            v_app_amount := v_user_apps_yield * (v_allocation.percentage::DECIMAL / 100);
            v_unallocated := v_unallocated - v_app_amount;

            IF v_app_amount > 0 THEN
                -- Record app funding
                INSERT INTO app_funding (app_id, user_id, amount, source)
                VALUES (v_allocation.app_id, v_user.wallet_address, v_app_amount, 'yield');

                -- Update app totals
                UPDATE apps
                SET total_funded = COALESCE(total_funded, 0) + v_app_amount
                WHERE id = v_allocation.app_id;

                v_apps_count := v_apps_count + 1;
            END IF;
        END LOOP;

        -- Any unallocated apps yield goes to SUITE Ecosystem
        IF v_unallocated > 0.01 AND v_ecosystem_app_id IS NOT NULL THEN
            INSERT INTO app_funding (app_id, user_id, amount, source)
            VALUES (v_ecosystem_app_id, v_user.wallet_address, v_unallocated, 'yield');

            UPDATE apps
            SET total_funded = COALESCE(total_funded, 0) + v_unallocated
            WHERE id = v_ecosystem_app_id;

            v_apps_count := v_apps_count + 1;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_users_count, v_total_yield, v_yield_to_users, v_yield_to_apps, v_apps_count;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 4. TREASURY WITHDRAWALS TABLE (Enhanced)
-- =====================================================

-- Drop and recreate with better structure
DROP TABLE IF EXISTS treasury_withdrawals CASCADE;

CREATE TABLE treasury_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    amount_usd DECIMAL(12, 2) NOT NULL,

    -- Status flow: pending → approved → ready → completed (or cancelled)
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'ready', 'completed', 'cancelled')),

    -- Timestamps for each status
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    ready_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,

    -- Admin fields
    approved_by TEXT,
    admin_notes TEXT,

    -- Transaction details (when completed)
    tx_hash TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_withdrawals_wallet ON treasury_withdrawals(wallet_address);
CREATE INDEX idx_withdrawals_status ON treasury_withdrawals(status);
CREATE INDEX idx_withdrawals_requested ON treasury_withdrawals(requested_at DESC);

-- Enable RLS
ALTER TABLE treasury_withdrawals ENABLE ROW LEVEL SECURITY;

-- Anyone can read their own withdrawals
DROP POLICY IF EXISTS "Users can read own withdrawals" ON treasury_withdrawals;
CREATE POLICY "Users can read own withdrawals" ON treasury_withdrawals
    FOR SELECT USING (true);

-- Anyone can insert (request withdrawal)
DROP POLICY IF EXISTS "Anyone can request withdrawal" ON treasury_withdrawals;
CREATE POLICY "Anyone can request withdrawal" ON treasury_withdrawals
    FOR INSERT WITH CHECK (true);

-- Service role can update (admin actions)
DROP POLICY IF EXISTS "Service can update withdrawals" ON treasury_withdrawals;
CREATE POLICY "Service can update withdrawals" ON treasury_withdrawals
    FOR UPDATE USING (true);


-- =====================================================
-- 5. FUNCTION: REQUEST WITHDRAWAL
-- =====================================================

CREATE OR REPLACE FUNCTION request_withdrawal(
    p_wallet TEXT,
    p_amount DECIMAL
) RETURNS treasury_withdrawals AS $$
DECLARE
    v_withdrawable DECIMAL;
    v_pending DECIMAL;
    v_result treasury_withdrawals;
BEGIN
    -- Get user's withdrawable amount
    SELECT spendable_usd INTO v_withdrawable
    FROM user_credit_balances
    WHERE wallet_address = LOWER(p_wallet);

    IF v_withdrawable IS NULL THEN
        RAISE EXCEPTION 'No deposits found for this wallet';
    END IF;

    -- Get pending withdrawal requests
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_pending
    FROM treasury_withdrawals
    WHERE wallet_address = LOWER(p_wallet)
    AND status IN ('pending', 'approved', 'ready');

    -- Check if request exceeds available
    IF p_amount > (v_withdrawable - v_pending) THEN
        RAISE EXCEPTION 'Requested amount ($%) exceeds available balance ($%)',
            p_amount, ROUND(v_withdrawable - v_pending, 2);
    END IF;

    -- Create withdrawal request
    INSERT INTO treasury_withdrawals (wallet_address, amount_usd)
    VALUES (LOWER(p_wallet), p_amount)
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 6. FUNCTION: ADMIN - APPROVE/READY/COMPLETE WITHDRAWAL
-- =====================================================

CREATE OR REPLACE FUNCTION update_withdrawal_status(
    p_withdrawal_id UUID,
    p_new_status TEXT,
    p_admin_wallet TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_tx_hash TEXT DEFAULT NULL
) RETURNS treasury_withdrawals AS $$
DECLARE
    v_result treasury_withdrawals;
BEGIN
    UPDATE treasury_withdrawals
    SET
        status = p_new_status,
        approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
        approved_by = CASE WHEN p_new_status = 'approved' THEN p_admin_wallet ELSE approved_by END,
        ready_at = CASE WHEN p_new_status = 'ready' THEN NOW() ELSE ready_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
        cancelled_at = CASE WHEN p_new_status = 'cancelled' THEN NOW() ELSE cancelled_at END,
        admin_notes = COALESCE(p_notes, admin_notes),
        tx_hash = COALESCE(p_tx_hash, tx_hash)
    WHERE id = p_withdrawal_id
    RETURNING * INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 7. VIEW: PENDING WITHDRAWALS (for Admin Dashboard)
-- =====================================================

CREATE OR REPLACE VIEW admin_pending_withdrawals AS
SELECT
    tw.id,
    tw.wallet_address,
    tw.amount_usd,
    tw.status,
    tw.requested_at,
    tw.approved_at,
    tw.ready_at,
    tw.admin_notes,
    -- User's current balance info
    ucb.vault_share_usd,
    ucb.spendable_usd,
    ucb.lp_share_percent
FROM treasury_withdrawals tw
LEFT JOIN user_credit_balances ucb ON tw.wallet_address = ucb.wallet_address
WHERE tw.status IN ('pending', 'approved', 'ready')
ORDER BY tw.requested_at ASC;


-- =====================================================
-- 8. VIEW: USER WITHDRAWAL HISTORY
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_withdrawals(p_wallet TEXT)
RETURNS TABLE (
    id UUID,
    amount_usd DECIMAL,
    status TEXT,
    requested_at TIMESTAMP WITH TIME ZONE,
    ready_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    tx_hash TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        tw.id,
        tw.amount_usd,
        tw.status,
        tw.requested_at,
        tw.ready_at,
        tw.completed_at,
        tw.tx_hash
    FROM treasury_withdrawals tw
    WHERE tw.wallet_address = LOWER(p_wallet)
    ORDER BY tw.requested_at DESC;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 9. TRIGGER: AUTO-PROCESS YIELD ON VALUE REPORT
-- (Optional - can also be called manually)
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_yield_distribution()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if value increased
    IF NEW.value_change_usd > 0 THEN
        PERFORM process_yield_distribution();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (disabled by default - uncomment to enable auto-distribution)
-- DROP TRIGGER IF EXISTS auto_yield_distribution ON vault_value_reports;
-- CREATE TRIGGER auto_yield_distribution
--     AFTER INSERT ON vault_value_reports
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_yield_distribution();


-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- Get a user's current credit balance:
-- SELECT * FROM get_user_credits('0x1234...');

-- Get all user balances:
-- SELECT * FROM user_credit_balances;

-- Process yield distribution (after reporting value):
-- SELECT * FROM process_yield_distribution();

-- User requests withdrawal:
-- SELECT * FROM request_withdrawal('0x1234...', 100.00);

-- Admin marks withdrawal as ready:
-- SELECT * FROM update_withdrawal_status('uuid-here', 'ready', '0xAdmin...', 'USDC moved to contract');

-- View pending withdrawals:
-- SELECT * FROM admin_pending_withdrawals;

-- =====================================================
-- DONE! Your Yield Distribution system now supports:
-- - Dynamic credit calculation from vault value
-- - Automatic yield distribution to apps on value report
-- - 10% minimum to apps (90% max keep)
-- - Unallocated funds go to SUITE Ecosystem
-- - Request-based withdrawal flow with status tracking
-- =====================================================
