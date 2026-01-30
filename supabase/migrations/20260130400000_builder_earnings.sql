-- Builder Earnings Migration
-- Adds builder_markup and total_earnings to user_apps
-- Creates deduct_app_credits function
-- Updates credit_transactions type constraint
-- Adds user_app_id to factory_proposals

-- 1. Add columns to user_apps
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS builder_markup DECIMAL(12,4) DEFAULT 0;
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,4) DEFAULT 0;

-- 2. Add user_app_id to factory_proposals (for auto-proposals)
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS user_app_id UUID;

-- 3. Update credit_transactions type constraint to include 'builder_earning'
ALTER TABLE credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_type_check;
ALTER TABLE credit_transactions ADD CONSTRAINT credit_transactions_type_check
    CHECK (type IN ('deposit', 'usage', 'refund', 'bonus', 'builder_earning'));

-- 4. Create deduct_app_credits function
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
        -- Find builder's wallet from auth metadata
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
