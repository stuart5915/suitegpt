-- SUITE Treasury System Database Schema
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. TREASURY DEPOSITS - Track user deposits & LP tokens
-- =====================================================
CREATE TABLE IF NOT EXISTS treasury_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  amount_deposited DECIMAL(20, 8) NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('ETH', 'USDC')),
  usd_value_at_deposit DECIMAL(20, 2),
  lp_tokens_issued DECIMAL(20, 8) NOT NULL,
  deposited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  withdrawn BOOLEAN DEFAULT FALSE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Index for fast lookup by wallet
CREATE INDEX IF NOT EXISTS idx_deposits_wallet ON treasury_deposits(wallet_address);

-- =====================================================
-- 2. YIELD ALLOCATIONS - User preferences (keep vs fund)
-- =====================================================
CREATE TABLE IF NOT EXISTS yield_allocations (
  wallet_address TEXT PRIMARY KEY,
  keep_percent INTEGER NOT NULL DEFAULT 90 
    CHECK (keep_percent >= 0 AND keep_percent <= 90), -- Max 90%, min 10% to apps
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. YIELD BALANCES - Accumulated withdrawable yield
-- =====================================================
CREATE TABLE IF NOT EXISTS yield_balances (
  wallet_address TEXT PRIMARY KEY,
  withdrawable_yield_usd DECIMAL(20, 2) DEFAULT 0,
  total_earned_usd DECIMAL(20, 2) DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- 4. YIELD SNAPSHOTS - Weekly yield calculations
-- =====================================================
CREATE TABLE IF NOT EXISTS yield_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  total_treasury_value_usd DECIMAL(20, 2),
  total_lp_supply DECIMAL(20, 8),
  yield_generated_usd DECIMAL(20, 2),
  yield_per_lp DECIMAL(20, 8),
  effective_apy DECIMAL(5, 2),
  admin_share_usd DECIMAL(20, 2),
  user_share_usd DECIMAL(20, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_start)
);

-- =====================================================
-- 5. ADMIN WALLET - Track admin's accumulated yield
-- =====================================================
-- The admin wallet is just a special row in yield_balances
-- Insert admin wallet on first run:
INSERT INTO yield_balances (wallet_address, withdrawable_yield_usd, total_earned_usd)
VALUES ('ADMIN_TREASURY', 0, 0)
ON CONFLICT (wallet_address) DO NOTHING;

-- =====================================================
-- 6. WITHDRAWAL HISTORY - Track all withdrawals
-- =====================================================
CREATE TABLE IF NOT EXISTS treasury_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  withdrawal_type TEXT NOT NULL CHECK (withdrawal_type IN ('yield', 'principal')),
  amount_usd DECIMAL(20, 2),
  amount_token DECIMAL(20, 8),
  token_type TEXT,
  tx_hash TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: Current LP token holdings per wallet
CREATE OR REPLACE VIEW wallet_lp_balances AS
SELECT 
  wallet_address,
  SUM(CASE WHEN NOT withdrawn THEN lp_tokens_issued ELSE 0 END) as lp_balance,
  SUM(CASE WHEN NOT withdrawn THEN usd_value_at_deposit ELSE 0 END) as total_deposited_usd,
  COUNT(*) as deposit_count
FROM treasury_deposits
GROUP BY wallet_address;

-- View: Treasury totals
CREATE OR REPLACE VIEW treasury_totals AS
SELECT 
  SUM(CASE WHEN NOT withdrawn THEN lp_tokens_issued ELSE 0 END) as total_lp_supply,
  SUM(CASE WHEN NOT withdrawn THEN usd_value_at_deposit ELSE 0 END) as total_deposits_usd,
  COUNT(DISTINCT wallet_address) as unique_depositors
FROM treasury_deposits;

-- =====================================================
-- ENABLE RLS (Row Level Security) - Important for security
-- =====================================================
ALTER TABLE treasury_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE yield_balances ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users view own deposits" ON treasury_deposits
  FOR SELECT USING (true); -- Public read for now, can restrict later

CREATE POLICY "Users view own allocations" ON yield_allocations
  FOR SELECT USING (true);

CREATE POLICY "Users view own balances" ON yield_balances
  FOR SELECT USING (true);

-- Only service role can insert/update (admin operations)
CREATE POLICY "Service role manages deposits" ON treasury_deposits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages allocations" ON yield_allocations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages balances" ON yield_balances
  FOR ALL USING (auth.role() = 'service_role');
