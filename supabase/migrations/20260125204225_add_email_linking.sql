-- Add email/Google account linking to suite_credits
-- This extends the unified auth system to support email-based login

-- Add email/supabase linking columns to suite_credits
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS linked_email TEXT;
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS linked_supabase_id TEXT;

-- Unique indexes to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_email ON suite_credits(linked_email)
  WHERE linked_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_supabase_id ON suite_credits(linked_supabase_id)
  WHERE linked_supabase_id IS NOT NULL;

-- Function: get_or_create_credits_by_email
-- Purpose: For email-only users, creates a record or returns existing one
CREATE OR REPLACE FUNCTION get_or_create_credits_by_email(p_email TEXT, p_supabase_id TEXT DEFAULT NULL)
RETURNS TABLE(wallet_address TEXT, balance DECIMAL, locked_balance DECIMAL) AS $$
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
  INSERT INTO suite_credits (wallet_address, balance, locked_balance, linked_email, linked_supabase_id, created_at, updated_at)
  VALUES (NULL, 0, 0, p_email, p_supabase_id, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- Return the newly created or existing record
  RETURN QUERY SELECT sc.wallet_address, sc.balance, sc.locked_balance
  FROM suite_credits sc WHERE sc.linked_email = p_email;
END;
$$ LANGUAGE plpgsql;

-- Function: link_email_to_wallet
-- Purpose: User has wallet credits, wants to add email login capability
CREATE OR REPLACE FUNCTION link_email_to_wallet(
  p_wallet_address TEXT,
  p_email TEXT,
  p_supabase_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  existing_email_record RECORD;
BEGIN
  -- Check if email already linked to a different wallet
  SELECT wallet_address, balance INTO existing_email_record
  FROM suite_credits WHERE linked_email = p_email;

  IF existing_email_record IS NOT NULL THEN
    IF existing_email_record.wallet_address IS NOT NULL AND existing_email_record.wallet_address != LOWER(p_wallet_address) THEN
      RETURN json_build_object('success', false, 'error', 'Email already linked to another wallet');
    END IF;

    -- Email exists but has no wallet (email-only user with credits)
    -- This is a merge scenario - combine credits
    IF existing_email_record.wallet_address IS NULL AND existing_email_record.balance > 0 THEN
      -- Add email user's credits to wallet user
      UPDATE suite_credits
      SET balance = balance + existing_email_record.balance,
          linked_email = p_email,
          linked_supabase_id = COALESCE(p_supabase_id, linked_supabase_id),
          updated_at = NOW()
      WHERE wallet_address = LOWER(p_wallet_address);

      -- Delete the email-only record (now merged)
      DELETE FROM suite_credits WHERE linked_email = p_email AND wallet_address IS NULL;

      RETURN json_build_object('success', true, 'merged', true, 'merged_credits', existing_email_record.balance);
    END IF;
  END IF;

  -- Update wallet record to add email
  UPDATE suite_credits
  SET linked_email = p_email,
      linked_supabase_id = COALESCE(p_supabase_id, linked_supabase_id),
      updated_at = NOW()
  WHERE wallet_address = LOWER(p_wallet_address);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Function: link_wallet_to_email
-- Purpose: User has email credits, wants to add wallet for withdrawals
CREATE OR REPLACE FUNCTION link_wallet_to_email(
  p_wallet_address TEXT,
  p_email TEXT
) RETURNS JSON AS $$
DECLARE
  existing_wallet TEXT;
  wallet_record RECORD;
BEGIN
  -- Check if email record already has a wallet
  SELECT wallet_address INTO existing_wallet
  FROM suite_credits WHERE linked_email = p_email;

  IF existing_wallet IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Email already has wallet linked: ' || existing_wallet);
  END IF;

  -- Check if wallet already has its own credits record
  SELECT wallet_address, balance INTO wallet_record
  FROM suite_credits WHERE wallet_address = LOWER(p_wallet_address);

  IF wallet_record IS NOT NULL THEN
    -- Wallet has existing credits - need to merge (or reject for safety)
    RETURN json_build_object('success', false, 'error', 'Wallet already has credits. Contact support to merge accounts.');
  END IF;

  -- Link wallet to email record
  UPDATE suite_credits
  SET wallet_address = LOWER(p_wallet_address),
      updated_at = NOW()
  WHERE linked_email = p_email;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Email record not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Function: get_linked_accounts
-- Purpose: Get all linked identifiers for a user (for display in UI)
CREATE OR REPLACE FUNCTION get_linked_accounts(
  p_wallet_address TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_telegram_id TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
  record_data RECORD;
BEGIN
  -- Find the user's record by any identifier
  SELECT sc.wallet_address, sc.linked_email, sc.linked_supabase_id, sc.linked_telegram_id, sc.linked_telegram_username, sc.balance
  INTO record_data
  FROM suite_credits sc
  WHERE (p_wallet_address IS NOT NULL AND sc.wallet_address = LOWER(p_wallet_address))
     OR (p_email IS NOT NULL AND sc.linked_email = p_email)
     OR (p_telegram_id IS NOT NULL AND sc.linked_telegram_id = p_telegram_id)
  LIMIT 1;

  IF record_data IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object(
    'found', true,
    'wallet_address', record_data.wallet_address,
    'linked_email', record_data.linked_email,
    'linked_telegram_id', record_data.linked_telegram_id,
    'linked_telegram_username', record_data.linked_telegram_username,
    'balance', record_data.balance
  );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION get_or_create_credits_by_email TO anon, authenticated;
GRANT EXECUTE ON FUNCTION link_email_to_wallet TO anon, authenticated;
GRANT EXECUTE ON FUNCTION link_wallet_to_email TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_linked_accounts TO anon, authenticated;
