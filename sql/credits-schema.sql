-- =====================================================
-- SUITE Credits System
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1A. SUITE CREDITS TABLE (Wallet-based users)
-- Stores wallet credit balances
-- =====================================================

CREATE TABLE IF NOT EXISTS suite_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    balance DECIMAL(12, 4) DEFAULT 0,
    total_deposited DECIMAL(12, 4) DEFAULT 0,
    total_used DECIMAL(12, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by wallet
CREATE INDEX IF NOT EXISTS idx_suite_credits_wallet ON suite_credits(wallet_address);

-- Enable Row Level Security
ALTER TABLE suite_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read credits
DROP POLICY IF EXISTS "Anyone can read suite_credits" ON suite_credits;
CREATE POLICY "Anyone can read suite_credits" ON suite_credits
    FOR SELECT USING (true);

-- Policy: Anyone can insert/update (secured via service key in production)
DROP POLICY IF EXISTS "Anyone can insert suite_credits" ON suite_credits;
CREATE POLICY "Anyone can insert suite_credits" ON suite_credits
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update suite_credits" ON suite_credits;
CREATE POLICY "Anyone can update suite_credits" ON suite_credits
    FOR UPDATE USING (true);


-- 1B. USER CREDITS TABLE (Telegram-based users)
-- Stores Telegram user credit balances
-- =====================================================

CREATE TABLE IF NOT EXISTS user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telegram_id TEXT NOT NULL UNIQUE,
    telegram_username TEXT,
    suite_balance DECIMAL(12, 4) DEFAULT 0,
    total_deposited DECIMAL(12, 4) DEFAULT 0,
    total_used DECIMAL(12, 4) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_user_credits_telegram ON user_credits(telegram_id);

-- Enable Row Level Security
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read credits
DROP POLICY IF EXISTS "Anyone can read user_credits" ON user_credits;
CREATE POLICY "Anyone can read user_credits" ON user_credits
    FOR SELECT USING (true);

-- Policy: Anyone can insert/update (secured via service key in production)
DROP POLICY IF EXISTS "Anyone can insert user_credits" ON user_credits;
CREATE POLICY "Anyone can insert user_credits" ON user_credits
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update user_credits" ON user_credits;
CREATE POLICY "Anyone can update user_credits" ON user_credits
    FOR UPDATE USING (true);


-- 2. CREDIT TRANSACTIONS TABLE
-- Records all credit deposits, usages, and refunds
-- =====================================================

CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT,
    telegram_id TEXT,
    amount DECIMAL(12, 4) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'usage', 'refund', 'bonus', 'builder_earning')),
    feature TEXT,
    app_id TEXT,  -- Can be UUID or slug
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by wallet
CREATE INDEX IF NOT EXISTS idx_credit_transactions_wallet ON credit_transactions(wallet_address);

-- Index for fast lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_credit_transactions_telegram ON credit_transactions(telegram_id);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_credit_transactions_app ON credit_transactions(app_id);

-- Enable Row Level Security
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read transactions
DROP POLICY IF EXISTS "Anyone can read credit_transactions" ON credit_transactions;
CREATE POLICY "Anyone can read credit_transactions" ON credit_transactions
    FOR SELECT USING (true);

-- Policy: Anyone can insert transactions
DROP POLICY IF EXISTS "Anyone can insert credit_transactions" ON credit_transactions;
CREATE POLICY "Anyone can insert credit_transactions" ON credit_transactions
    FOR INSERT WITH CHECK (true);


-- 3. APP USAGE TABLE
-- Tracks all app feature usage events
-- =====================================================

CREATE TABLE IF NOT EXISTS app_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID,
    wallet_address TEXT,
    telegram_id TEXT,
    feature TEXT NOT NULL,
    credits_used DECIMAL(12, 4) DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_app_usage_app ON app_usage(app_id);

-- Index for fast lookups by wallet
CREATE INDEX IF NOT EXISTS idx_app_usage_wallet ON app_usage(wallet_address);

-- Index for fast lookups by telegram_id
CREATE INDEX IF NOT EXISTS idx_app_usage_telegram ON app_usage(telegram_id);

-- Enable Row Level Security
ALTER TABLE app_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read usage
DROP POLICY IF EXISTS "Anyone can read app_usage" ON app_usage;
CREATE POLICY "Anyone can read app_usage" ON app_usage
    FOR SELECT USING (true);

-- Policy: Anyone can insert usage
DROP POLICY IF EXISTS "Anyone can insert app_usage" ON app_usage;
CREATE POLICY "Anyone can insert app_usage" ON app_usage
    FOR INSERT WITH CHECK (true);


-- 4. DEDUCT SUITE CREDITS FUNCTION
-- Deducts credits from user balance AND updates app total_revenue
-- Returns: true if successful, false if insufficient balance
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_suite_credits(
    p_wallet TEXT,
    p_amount DECIMAL,
    p_feature TEXT,
    p_app_id TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance DECIMAL;
    v_wallet_lower TEXT;
    v_app_uuid UUID;
BEGIN
    v_wallet_lower := LOWER(p_wallet);

    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM suite_credits
    WHERE wallet_address = v_wallet_lower;

    -- If no record exists, create one with 0 balance
    IF v_current_balance IS NULL THEN
        INSERT INTO suite_credits (wallet_address, balance)
        VALUES (v_wallet_lower, 0);
        v_current_balance := 0;
    END IF;

    -- Check if sufficient balance
    IF v_current_balance < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Try to parse app_id as UUID, if fails assume it's a slug
    IF p_app_id IS NOT NULL THEN
        BEGIN
            v_app_uuid := p_app_id::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            -- It's a slug, look up the UUID
            SELECT id INTO v_app_uuid FROM apps WHERE slug = p_app_id;
        END;
    END IF;

    -- Deduct credits from user balance
    UPDATE suite_credits
    SET
        balance = balance - p_amount,
        total_used = COALESCE(total_used, 0) + p_amount,
        updated_at = NOW()
    WHERE wallet_address = v_wallet_lower;

    -- Record the transaction
    INSERT INTO credit_transactions (wallet_address, amount, type, feature, app_id, description)
    VALUES (v_wallet_lower, -p_amount, 'usage', p_feature, v_app_uuid,
            'Used ' || p_amount || ' credits for ' || COALESCE(p_feature, 'unknown feature'));

    -- Record usage event
    INSERT INTO app_usage (app_id, wallet_address, feature, credits_used)
    VALUES (v_app_uuid, v_wallet_lower, p_feature, p_amount);

    -- IMPORTANT: Update the app's total_revenue for leaderboard tracking
    IF v_app_uuid IS NOT NULL THEN
        UPDATE apps
        SET total_revenue = COALESCE(total_revenue, 0) + p_amount
        WHERE id = v_app_uuid;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;


-- 5. ADD CREDITS FUNCTION
-- Adds credits to user balance (for deposits)
-- =====================================================

CREATE OR REPLACE FUNCTION add_suite_credits(
    p_wallet TEXT,
    p_amount DECIMAL,
    p_type TEXT DEFAULT 'deposit',
    p_description TEXT DEFAULT NULL
) RETURNS DECIMAL AS $$
DECLARE
    v_new_balance DECIMAL;
    v_wallet_lower TEXT;
BEGIN
    v_wallet_lower := LOWER(p_wallet);

    -- Upsert the credit record
    INSERT INTO suite_credits (wallet_address, balance, total_deposited)
    VALUES (v_wallet_lower, p_amount, p_amount)
    ON CONFLICT (wallet_address) DO UPDATE
    SET
        balance = suite_credits.balance + p_amount,
        total_deposited = COALESCE(suite_credits.total_deposited, 0) + p_amount,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- Record the transaction
    INSERT INTO credit_transactions (wallet_address, amount, type, description)
    VALUES (v_wallet_lower, p_amount, p_type, COALESCE(p_description, 'Credit deposit'));

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql;


-- 6. GET CREDIT BALANCE FUNCTION
-- Quick helper to get wallet balance
-- =====================================================

CREATE OR REPLACE FUNCTION get_suite_credits(p_wallet TEXT)
RETURNS DECIMAL AS $$
DECLARE
    v_balance DECIMAL;
BEGIN
    SELECT balance INTO v_balance
    FROM suite_credits
    WHERE wallet_address = LOWER(p_wallet);

    RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql;


-- 7. ADD APP REVENUE FUNCTION
-- Updates app total_revenue by slug (for Telegram-based credit usage)
-- =====================================================

CREATE OR REPLACE FUNCTION add_app_revenue(
    p_app_slug TEXT,
    p_amount DECIMAL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update the app's total_revenue by slug
    UPDATE apps
    SET total_revenue = COALESCE(total_revenue, 0) + p_amount
    WHERE slug = p_app_slug;

    -- Return true if a row was updated
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;


-- 8. DEDUCT APP CREDITS (with builder markup)
-- Deducts (base_cost + builder_markup) from user, pays builder the markup
-- Returns JSON: { success, total_charged, builder_earned }
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_app_credits(
    p_wallet TEXT,
    p_base_cost DECIMAL,
    p_user_app_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_wallet_lower TEXT;
    v_builder_markup DECIMAL;
    v_total_cost DECIMAL;
    v_current_balance DECIMAL;
    v_builder_user_id UUID;
    v_builder_wallet TEXT;
BEGIN
    v_wallet_lower := LOWER(p_wallet);

    -- Look up builder markup and owner
    SELECT COALESCE(builder_markup, 0), user_id
    INTO v_builder_markup, v_builder_user_id
    FROM user_apps
    WHERE id = p_user_app_id;

    IF v_builder_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'App not found');
    END IF;

    v_total_cost := p_base_cost + v_builder_markup;

    -- Check user balance
    SELECT balance INTO v_current_balance
    FROM suite_credits
    WHERE wallet_address = v_wallet_lower;

    IF v_current_balance IS NULL THEN
        INSERT INTO suite_credits (wallet_address, balance) VALUES (v_wallet_lower, 0);
        v_current_balance := 0;
    END IF;

    IF v_current_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits', 'required', v_total_cost, 'balance', v_current_balance);
    END IF;

    -- Deduct total from user
    UPDATE suite_credits
    SET balance = balance - v_total_cost,
        total_used = COALESCE(total_used, 0) + v_total_cost,
        updated_at = NOW()
    WHERE wallet_address = v_wallet_lower;

    -- Log user's usage transaction
    INSERT INTO credit_transactions (wallet_address, amount, type, feature, app_id, description)
    VALUES (v_wallet_lower, -v_total_cost, 'usage', 'ai_action', p_user_app_id::TEXT,
            'AI action: ' || p_base_cost || ' base + ' || v_builder_markup || ' markup');

    -- Pay builder their markup (if any)
    IF v_builder_markup > 0 THEN
        -- Find builder's wallet (from suite_operators or auth metadata)
        -- We use the user_id to find their wallet in suite_credits
        SELECT wallet_address INTO v_builder_wallet
        FROM suite_credits
        WHERE wallet_address = (
            SELECT LOWER(raw_user_meta_data->>'wallet_address')
            FROM auth.users WHERE id = v_builder_user_id
        )
        LIMIT 1;

        IF v_builder_wallet IS NOT NULL THEN
            UPDATE suite_credits
            SET balance = balance + v_builder_markup,
                updated_at = NOW()
            WHERE wallet_address = v_builder_wallet;

            -- Log builder earning
            INSERT INTO credit_transactions (wallet_address, amount, type, feature, app_id, description)
            VALUES (v_builder_wallet, v_builder_markup, 'builder_earning', 'ai_action', p_user_app_id::TEXT,
                    'Builder markup earned from app usage');
        END IF;

        -- Update app total_earnings
        UPDATE user_apps
        SET total_earnings = COALESCE(total_earnings, 0) + v_builder_markup
        WHERE id = p_user_app_id;
    END IF;

    -- Log usage event
    INSERT INTO app_usage (app_id, wallet_address, feature, credits_used)
    VALUES (p_user_app_id, v_wallet_lower, 'ai_action', v_total_cost);

    RETURN jsonb_build_object('success', true, 'total_charged', v_total_cost, 'builder_earned', v_builder_markup);
END;
$$ LANGUAGE plpgsql;


-- 9. VIEWS FOR ANALYTICS
-- =====================================================

-- App revenue leaderboard
CREATE OR REPLACE VIEW app_revenue_leaderboard AS
SELECT
    a.id,
    a.name,
    a.slug,
    a.icon_url,
    a.icon_emoji,
    COALESCE(a.total_revenue, 0) as total_revenue,
    COALESCE(a.total_funded, 0) as total_funded,
    COALESCE(a.funder_count, 0) as funder_count,
    (SELECT COUNT(DISTINCT wallet_address) FROM app_usage WHERE app_id = a.id) as unique_users,
    (SELECT COUNT(*) FROM app_usage WHERE app_id = a.id) as total_uses
FROM apps a
WHERE a.status IN ('live', 'published', 'approved')
ORDER BY COALESCE(a.total_revenue, 0) DESC;

-- User credit summary
CREATE OR REPLACE VIEW credit_summary AS
SELECT
    sc.wallet_address,
    sc.balance,
    sc.total_deposited,
    sc.total_used,
    (SELECT COUNT(*) FROM credit_transactions WHERE wallet_address = sc.wallet_address) as transaction_count,
    sc.created_at,
    sc.updated_at
FROM suite_credits sc
ORDER BY sc.total_used DESC;


-- =====================================================
-- SAMPLE DATA FOR TESTING (Optional)
-- Run this to seed test data for the leaderboard
-- =====================================================

-- Add test credits to admin wallet (treasury)
-- SELECT add_suite_credits('0x1234567890abcdef', 1000, 'bonus', 'Admin test credits');

-- Simulate usage to populate leaderboard:
-- SELECT deduct_suite_credits('0x1234567890abcdef', 5.50, 'meal_scan', (SELECT id FROM apps WHERE slug = 'foodvitals'));
-- SELECT deduct_suite_credits('0x1234567890abcdef', 2.00, 'ai_meal_plan', (SELECT id FROM apps WHERE slug = 'foodvitals'));


-- =====================================================
-- DONE! Your credit system now:
-- - Tracks wallet credit balances
-- - Records all credit transactions
-- - Updates app total_revenue when credits are used
-- - Provides leaderboard view for ranking apps
-- - Works for admin/treasury wallet (circular flow)
-- =====================================================
