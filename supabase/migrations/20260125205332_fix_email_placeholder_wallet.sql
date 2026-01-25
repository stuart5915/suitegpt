-- Fix functions for unified auth
-- wallet_address is NOT NULL, so email-only users get 'email:user@example.com' as placeholder

-- Drop existing function first
DROP FUNCTION IF EXISTS get_or_create_credits_by_email(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_or_create_credits_by_email(p_email TEXT, p_supabase_id TEXT DEFAULT NULL)
RETURNS TABLE(wallet_address TEXT, balance NUMERIC, locked_balance NUMERIC) AS $$
DECLARE
  placeholder_wallet TEXT;
BEGIN
  placeholder_wallet := 'email:' || p_email;

  -- Try to find by linked_email first
  RETURN QUERY SELECT sc.wallet_address, sc.balance::NUMERIC, sc.locked_balance::NUMERIC
  FROM suite_credits sc WHERE sc.linked_email = p_email;
  IF FOUND THEN RETURN; END IF;

  -- Try by supabase_id if provided
  IF p_supabase_id IS NOT NULL THEN
    RETURN QUERY SELECT sc.wallet_address, sc.balance::NUMERIC, sc.locked_balance::NUMERIC
    FROM suite_credits sc WHERE sc.linked_supabase_id = p_supabase_id;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Try by placeholder wallet
  RETURN QUERY SELECT sc.wallet_address, sc.balance::NUMERIC, sc.locked_balance::NUMERIC
  FROM suite_credits sc WHERE sc.wallet_address = placeholder_wallet;
  IF FOUND THEN RETURN; END IF;

  -- Create new record for email-only user with placeholder wallet
  INSERT INTO suite_credits (wallet_address, balance, locked_balance, linked_email, linked_supabase_id, updated_at)
  VALUES (placeholder_wallet, 0, 0, p_email, p_supabase_id, NOW())
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Return the newly created record
  RETURN QUERY SELECT sc.wallet_address, sc.balance::NUMERIC, sc.locked_balance::NUMERIC
  FROM suite_credits sc WHERE sc.wallet_address = placeholder_wallet;
END;
$$ LANGUAGE plpgsql;

-- Also fix the telegram function
DROP FUNCTION IF EXISTS get_credits_by_telegram(TEXT);

CREATE OR REPLACE FUNCTION get_credits_by_telegram(tg_id TEXT)
RETURNS TABLE(
  wallet_address TEXT,
  balance NUMERIC,
  locked_balance NUMERIC,
  linked_telegram_username TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.wallet_address,
    sc.balance::NUMERIC,
    sc.locked_balance::NUMERIC,
    sc.linked_telegram_username
  FROM suite_credits sc
  WHERE sc.linked_telegram_id = tg_id;
END;
$$ LANGUAGE plpgsql;

-- Update link_wallet_to_email to handle placeholder replacement
DROP FUNCTION IF EXISTS link_wallet_to_email(TEXT, TEXT);

CREATE OR REPLACE FUNCTION link_wallet_to_email(
  p_wallet_address TEXT,
  p_email TEXT
) RETURNS JSON AS $$
DECLARE
  email_record RECORD;
  wallet_record RECORD;
  placeholder_wallet TEXT;
BEGIN
  placeholder_wallet := 'email:' || p_email;

  -- Check if email record exists (either by linked_email or placeholder wallet)
  SELECT * INTO email_record
  FROM suite_credits
  WHERE linked_email = p_email OR wallet_address = placeholder_wallet;

  IF email_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Email account not found');
  END IF;

  -- If email already has a real wallet linked
  IF email_record.wallet_address IS NOT NULL
     AND email_record.wallet_address != placeholder_wallet
     AND NOT email_record.wallet_address LIKE 'email:%' THEN
    RETURN json_build_object('success', false, 'error', 'Email already has wallet linked: ' || email_record.wallet_address);
  END IF;

  -- Check if the real wallet already has its own record
  SELECT * INTO wallet_record
  FROM suite_credits WHERE wallet_address = LOWER(p_wallet_address);

  IF wallet_record IS NOT NULL THEN
    -- Wallet has existing credits - merge email's credits into it
    UPDATE suite_credits
    SET balance = balance + email_record.balance,
        locked_balance = locked_balance + email_record.locked_balance,
        linked_email = p_email,
        linked_supabase_id = COALESCE(email_record.linked_supabase_id, linked_supabase_id),
        updated_at = NOW()
    WHERE wallet_address = LOWER(p_wallet_address);

    -- Delete the placeholder record
    DELETE FROM suite_credits WHERE wallet_address = placeholder_wallet;

    RETURN json_build_object('success', true, 'merged', true, 'merged_credits', email_record.balance);
  END IF;

  -- No existing wallet record - update the placeholder to use real wallet
  UPDATE suite_credits
  SET wallet_address = LOWER(p_wallet_address),
      updated_at = NOW()
  WHERE wallet_address = placeholder_wallet;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_or_create_credits_by_email TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_credits_by_telegram TO anon, authenticated;
GRANT EXECUTE ON FUNCTION link_wallet_to_email TO anon, authenticated;
