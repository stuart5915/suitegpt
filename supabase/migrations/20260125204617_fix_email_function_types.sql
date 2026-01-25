-- Fix return type mismatch in get_or_create_credits_by_email function
-- The balance column is INTEGER in the table, not DECIMAL

-- Drop existing function first (can't change return type without dropping)
DROP FUNCTION IF EXISTS get_or_create_credits_by_email(TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_or_create_credits_by_email(p_email TEXT, p_supabase_id TEXT DEFAULT NULL)
RETURNS TABLE(wallet_address TEXT, balance INTEGER, locked_balance INTEGER) AS $$
BEGIN
  -- Try to find by email first
  RETURN QUERY SELECT sc.wallet_address, sc.balance, sc.locked_balance
  FROM suite_credits sc WHERE sc.linked_email = p_email;
  IF FOUND THEN RETURN; END IF;

  -- Try by supabase_id if provided
  IF p_supabase_id IS NOT NULL THEN
    RETURN QUERY SELECT sc.wallet_address, sc.balance, sc.locked_balance
    FROM suite_credits sc WHERE sc.linked_supabase_id = p_supabase_id;
    IF FOUND THEN RETURN; END IF;
  END IF;

  -- Create new record for email-only user (no wallet)
  INSERT INTO suite_credits (wallet_address, balance, locked_balance, linked_email, linked_supabase_id, updated_at)
  VALUES (NULL, 0, 0, p_email, p_supabase_id, NOW())
  ON CONFLICT DO NOTHING;

  -- Return the newly created or existing record
  RETURN QUERY SELECT sc.wallet_address, sc.balance, sc.locked_balance
  FROM suite_credits sc WHERE sc.linked_email = p_email;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_or_create_credits_by_email TO anon, authenticated;
