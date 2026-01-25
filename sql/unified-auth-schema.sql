-- Unified Auth Schema
-- Wallet = source of truth, Telegram can be linked (one-way)
-- Run this in Supabase SQL Editor

-- 1. Add telegram linking columns to suite_credits
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS linked_telegram_id TEXT;
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS linked_telegram_username TEXT;

-- Create unique index (one telegram can only link to one wallet)
DROP INDEX IF EXISTS idx_linked_telegram;
CREATE UNIQUE INDEX idx_linked_telegram ON suite_credits(linked_telegram_id)
  WHERE linked_telegram_id IS NOT NULL;

-- 2. Add locked balance for fiat credits (non-withdrawable)
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS locked_balance DECIMAL DEFAULT 0;

-- 3. Create pending links table (for bot verification flow)
CREATE TABLE IF NOT EXISTS pending_telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes'
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_pending_links_expires ON pending_telegram_links(expires_at);

-- 4. Delete unused user_credits table (if exists)
DROP TABLE IF EXISTS user_credits CASCADE;

-- 5. Function to get credits by telegram (for telegram login)
CREATE OR REPLACE FUNCTION get_credits_by_telegram(tg_id TEXT)
RETURNS TABLE(
  wallet_address TEXT,
  balance DECIMAL,
  locked_balance DECIMAL,
  linked_telegram_username TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sc.wallet_address,
    sc.balance,
    sc.locked_balance,
    sc.linked_telegram_username
  FROM suite_credits sc
  WHERE sc.linked_telegram_id = tg_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to link telegram to wallet
CREATE OR REPLACE FUNCTION link_telegram_to_wallet(
  p_wallet_address TEXT,
  p_telegram_id TEXT,
  p_telegram_username TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  existing_link TEXT;
BEGIN
  -- Check if telegram is already linked to another wallet
  SELECT wallet_address INTO existing_link
  FROM suite_credits
  WHERE linked_telegram_id = p_telegram_id;

  IF existing_link IS NOT NULL AND existing_link != p_wallet_address THEN
    RAISE EXCEPTION 'Telegram already linked to another wallet';
  END IF;

  -- Update the wallet with telegram link
  UPDATE suite_credits
  SET
    linked_telegram_id = p_telegram_id,
    linked_telegram_username = p_telegram_username,
    updated_at = NOW()
  WHERE wallet_address = LOWER(p_wallet_address);

  -- Clean up any pending links for this wallet
  DELETE FROM pending_telegram_links WHERE wallet_address = LOWER(p_wallet_address);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS policies for pending_telegram_links
ALTER TABLE pending_telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read pending links"
  ON pending_telegram_links
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert pending links"
  ON pending_telegram_links
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete pending links"
  ON pending_telegram_links
  FOR DELETE
  USING (true);

-- Grant access
GRANT SELECT, INSERT, DELETE ON pending_telegram_links TO anon;
GRANT SELECT, INSERT, DELETE ON pending_telegram_links TO authenticated;
GRANT EXECUTE ON FUNCTION get_credits_by_telegram TO anon;
GRANT EXECUTE ON FUNCTION get_credits_by_telegram TO authenticated;
GRANT EXECUTE ON FUNCTION link_telegram_to_wallet TO anon;
GRANT EXECUTE ON FUNCTION link_telegram_to_wallet TO authenticated;

-- ============================================================================
-- EMAIL/GOOGLE ACCOUNT LINKING (Added for unified auth v2)
-- ============================================================================

-- 8. Add email/supabase linking columns to suite_credits
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS linked_email TEXT;
ALTER TABLE suite_credits ADD COLUMN IF NOT EXISTS linked_supabase_id TEXT;

-- Unique indexes to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_email ON suite_credits(linked_email)
  WHERE linked_email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_supabase_id ON suite_credits(linked_supabase_id)
  WHERE linked_supabase_id IS NOT NULL;

-- 9. Function: get_or_create_credits_by_email
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

-- 10. Function: link_email_to_wallet
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

-- 11. Function: link_wallet_to_email
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

-- 12. Function: get_linked_accounts
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
