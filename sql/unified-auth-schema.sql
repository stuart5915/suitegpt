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
