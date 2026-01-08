-- SUITE Bridge Database Schema
-- Run this in your Supabase SQL Editor

-- Bridge transactions table - tracks all deposits and withdrawals
CREATE TABLE IF NOT EXISTS bridge_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    amount BIGINT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('deposit', 'withdraw')),
    tx_hash TEXT UNIQUE NOT NULL, -- Unique constraint prevents duplicate processing
    block_number BIGINT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet-Discord links table - links wallet addresses to Discord IDs
CREATE TABLE IF NOT EXISTS wallet_discord_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(discord_id, wallet_address)
);

-- Withdrawal requests table - pending withdrawal approvals
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL,
    wallet_address TEXT NOT NULL,
    amount BIGINT NOT NULL,
    nonce TEXT UNIQUE NOT NULL,
    signature TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'signed', 'claimed', 'expired')),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE bridge_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_discord_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Policies - allow read/write for anon (backend handles security)
CREATE POLICY "Allow all bridge_transactions" ON bridge_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all wallet_discord_links" ON wallet_discord_links FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all withdrawal_requests" ON withdrawal_requests FOR ALL USING (true) WITH CHECK (true);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_bridge_tx_discord ON bridge_transactions(discord_id);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_wallet ON bridge_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_bridge_tx_hash ON bridge_transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_wallet_links_discord ON wallet_discord_links(discord_id);
CREATE INDEX IF NOT EXISTS idx_wallet_links_wallet ON wallet_discord_links(wallet_address);
CREATE INDEX IF NOT EXISTS idx_withdrawal_nonce ON withdrawal_requests(nonce);

-- Grant access
GRANT ALL ON bridge_transactions TO anon, authenticated;
GRANT ALL ON wallet_discord_links TO anon, authenticated;
GRANT ALL ON withdrawal_requests TO anon, authenticated;

-- Function to safely credit Discord balance (prevents race conditions)
CREATE OR REPLACE FUNCTION credit_discord_balance(
    p_discord_id TEXT,
    p_wallet_address TEXT,
    p_amount BIGINT,
    p_tx_hash TEXT,
    p_block_number BIGINT
) RETURNS BOOLEAN AS $$
DECLARE
    v_existing_tx UUID;
BEGIN
    -- Check if transaction already processed (idempotency)
    SELECT id INTO v_existing_tx FROM bridge_transactions WHERE tx_hash = p_tx_hash;
    IF v_existing_tx IS NOT NULL THEN
        RETURN FALSE; -- Already processed
    END IF;
    
    -- Insert transaction record
    INSERT INTO bridge_transactions (discord_id, wallet_address, amount, direction, tx_hash, block_number)
    VALUES (p_discord_id, p_wallet_address, p_amount, 'deposit', p_tx_hash, p_block_number);
    
    -- Update or insert user balance
    INSERT INTO user_balances (discord_id, balance, lifetime_earnings)
    VALUES (p_discord_id, p_amount, p_amount)
    ON CONFLICT (discord_id) DO UPDATE
    SET balance = user_balances.balance + p_amount,
        updated_at = NOW();
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
