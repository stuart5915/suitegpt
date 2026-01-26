-- Function to link Telegram account to wallet
CREATE OR REPLACE FUNCTION link_telegram_to_wallet(
  p_wallet_address TEXT,
  p_telegram_id TEXT,
  p_telegram_username TEXT DEFAULT NULL
) RETURNS JSON AS $$
BEGIN
  UPDATE suite_credits
  SET linked_telegram_id = p_telegram_id,
      linked_telegram_username = p_telegram_username,
      updated_at = NOW()
  WHERE wallet_address = LOWER(p_wallet_address);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION link_telegram_to_wallet TO anon, authenticated;
