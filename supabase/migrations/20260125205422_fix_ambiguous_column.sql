-- Fix ambiguous column reference by using different return column names

DROP FUNCTION IF EXISTS get_or_create_credits_by_email(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_or_create_credits_by_email(p_email TEXT, p_supabase_id TEXT DEFAULT NULL)
RETURNS TABLE(user_wallet TEXT, user_balance NUMERIC, user_locked_balance NUMERIC) AS $$
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
  user_wallet TEXT,
  user_balance NUMERIC,
  user_locked_balance NUMERIC,
  telegram_username TEXT
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_or_create_credits_by_email TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_credits_by_telegram TO anon, authenticated;
