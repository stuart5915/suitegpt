-- =====================================================
-- WITHDRAWAL CALCULATION SYSTEM
-- Calculates how much each user can withdraw
-- =====================================================

-- Function to calculate user's max withdrawable amount
-- Formula: (LP Share of Vault) - (Credits Used)
CREATE OR REPLACE FUNCTION calculate_withdrawable(p_wallet TEXT)
RETURNS TABLE (
    wallet_address TEXT,
    lp_tokens DECIMAL,
    total_lp_supply DECIMAL,
    lp_share_percent DECIMAL,
    current_vault_value DECIMAL,
    vault_share_usd DECIMAL,
    credits_used DECIMAL,
    withdrawable_usd DECIMAL,
    total_deposited_usd DECIMAL
) AS $$
DECLARE
    v_wallet TEXT;
    v_user_lp DECIMAL;
    v_total_lp DECIMAL;
    v_vault_value DECIMAL;
    v_credits_used DECIMAL;
BEGIN
    v_wallet := LOWER(p_wallet);

    -- Get user's LP tokens (sum of all non-withdrawn deposits)
    SELECT COALESCE(SUM(lp_tokens_issued), 0)
    INTO v_user_lp
    FROM treasury_deposits
    WHERE treasury_deposits.wallet_address = v_wallet
    AND withdrawn = FALSE;

    -- Get total LP supply
    SELECT COALESCE(SUM(lp_tokens_issued), 0)
    INTO v_total_lp
    FROM treasury_deposits
    WHERE withdrawn = FALSE;

    -- Get current vault value (from latest report)
    SELECT COALESCE(reported_value_usd, 0)
    INTO v_vault_value
    FROM vault_value_reports
    ORDER BY reported_at DESC
    LIMIT 1;

    -- If no vault reports yet, use total deposits as value
    IF v_vault_value = 0 THEN
        SELECT COALESCE(SUM(usd_value_at_deposit), 0)
        INTO v_vault_value
        FROM treasury_deposits
        WHERE withdrawn = FALSE;
    END IF;

    -- Get user's total credits used
    SELECT COALESCE(total_used, 0)
    INTO v_credits_used
    FROM suite_credits
    WHERE suite_credits.wallet_address = v_wallet;

    IF v_credits_used IS NULL THEN
        v_credits_used := 0;
    END IF;

    -- Return calculated values
    RETURN QUERY
    SELECT
        v_wallet AS wallet_address,
        v_user_lp AS lp_tokens,
        v_total_lp AS total_lp_supply,
        CASE WHEN v_total_lp > 0
            THEN ROUND((v_user_lp / v_total_lp) * 100, 4)
            ELSE 0
        END AS lp_share_percent,
        v_vault_value AS current_vault_value,
        CASE WHEN v_total_lp > 0
            THEN ROUND((v_user_lp / v_total_lp) * v_vault_value, 2)
            ELSE 0
        END AS vault_share_usd,
        v_credits_used AS credits_used,
        CASE WHEN v_total_lp > 0
            THEN GREATEST(ROUND((v_user_lp / v_total_lp) * v_vault_value - v_credits_used, 2), 0)
            ELSE 0
        END AS withdrawable_usd,
        (SELECT COALESCE(SUM(usd_value_at_deposit), 0)
         FROM treasury_deposits
         WHERE treasury_deposits.wallet_address = v_wallet AND withdrawn = FALSE) AS total_deposited_usd;
END;
$$ LANGUAGE plpgsql;


-- View: All users' withdrawable amounts
CREATE OR REPLACE VIEW user_withdrawable_amounts AS
SELECT
    td.wallet_address,
    SUM(td.lp_tokens_issued) AS lp_tokens,
    (SELECT SUM(lp_tokens_issued) FROM treasury_deposits WHERE withdrawn = FALSE) AS total_lp_supply,
    ROUND(
        SUM(td.lp_tokens_issued) /
        NULLIF((SELECT SUM(lp_tokens_issued) FROM treasury_deposits WHERE withdrawn = FALSE), 0) * 100
    , 4) AS lp_share_percent,
    (SELECT COALESCE(reported_value_usd, 0) FROM vault_value_reports ORDER BY reported_at DESC LIMIT 1) AS vault_value,
    ROUND(
        SUM(td.lp_tokens_issued) /
        NULLIF((SELECT SUM(lp_tokens_issued) FROM treasury_deposits WHERE withdrawn = FALSE), 0) *
        (SELECT COALESCE(reported_value_usd, 0) FROM vault_value_reports ORDER BY reported_at DESC LIMIT 1)
    , 2) AS vault_share_usd,
    COALESCE(sc.total_used, 0) AS credits_used,
    GREATEST(
        ROUND(
            SUM(td.lp_tokens_issued) /
            NULLIF((SELECT SUM(lp_tokens_issued) FROM treasury_deposits WHERE withdrawn = FALSE), 0) *
            (SELECT COALESCE(reported_value_usd, 0) FROM vault_value_reports ORDER BY reported_at DESC LIMIT 1)
        , 2) - COALESCE(sc.total_used, 0)
    , 0) AS withdrawable_usd,
    SUM(td.usd_value_at_deposit) AS total_deposited_usd
FROM treasury_deposits td
LEFT JOIN suite_credits sc ON td.wallet_address = sc.wallet_address
WHERE td.withdrawn = FALSE
GROUP BY td.wallet_address, sc.total_used;


-- Function to validate withdrawal request
-- Returns error message if invalid, NULL if valid
CREATE OR REPLACE FUNCTION validate_withdrawal_request(
    p_wallet TEXT,
    p_amount DECIMAL
) RETURNS TEXT AS $$
DECLARE
    v_withdrawable DECIMAL;
    v_pending_withdrawals DECIMAL;
BEGIN
    -- Get user's withdrawable amount
    SELECT withdrawable_usd INTO v_withdrawable
    FROM calculate_withdrawable(p_wallet);

    -- Get any pending withdrawal requests
    SELECT COALESCE(SUM(amount_usd), 0) INTO v_pending_withdrawals
    FROM treasury_withdrawals
    WHERE wallet_address = LOWER(p_wallet)
    AND status IN ('pending', 'approved');

    -- Check if request exceeds available
    IF p_amount > (v_withdrawable - v_pending_withdrawals) THEN
        RETURN 'Requested amount ($' || p_amount || ') exceeds available balance ($' ||
               ROUND(v_withdrawable - v_pending_withdrawals, 2) || ')';
    END IF;

    RETURN NULL; -- Valid request
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- Get a user's withdrawable amount:
-- SELECT * FROM calculate_withdrawable('0x1234...');

-- View all users' withdrawable amounts:
-- SELECT * FROM user_withdrawable_amounts;

-- Validate a withdrawal request:
-- SELECT validate_withdrawal_request('0x1234...', 500.00);
-- Returns NULL if valid, error message if invalid
