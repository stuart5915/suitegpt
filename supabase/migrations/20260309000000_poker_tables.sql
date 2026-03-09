-- PokerAI tables — real-money chip system backed by USDC

CREATE TABLE IF NOT EXISTS poker_wallets (
  address TEXT PRIMARY KEY,           -- lowercase ETH address
  chip_balance BIGINT NOT NULL DEFAULT 0,
  total_deposited_usdc BIGINT NOT NULL DEFAULT 0,  -- in USDC smallest units (1e6 = $1)
  total_withdrawn_usdc BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS poker_agents (
  id TEXT PRIMARY KEY,                -- custom_<wallet>_<timestamp>
  wallet_address TEXT NOT NULL REFERENCES poker_wallets(address),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🤖',
  style TEXT NOT NULL DEFAULT 'balanced',
  description TEXT,
  raise_pct INT NOT NULL DEFAULT 30,
  bluff_pct INT NOT NULL DEFAULT 20,
  fold_pct INT NOT NULL DEFAULT 30,
  traits JSONB NOT NULL DEFAULT '{}',
  rules JSONB NOT NULL DEFAULT '{}',
  chip_stack BIGINT NOT NULL DEFAULT 0,
  hands_won INT NOT NULL DEFAULT 0,
  hands_played INT NOT NULL DEFAULT 0,
  biggest_pot BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poker_agents_wallet ON poker_agents(wallet_address);

CREATE TABLE IF NOT EXISTS poker_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES poker_wallets(address),
  type TEXT NOT NULL,                 -- 'deposit', 'withdraw', 'rake', 'win', 'loss'
  usdc_amount BIGINT,                -- USDC smallest units (NULL for chip-only events)
  chip_amount BIGINT NOT NULL,
  tx_hash TEXT,                       -- on-chain tx hash (NULL for internal events)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poker_txns_wallet ON poker_transactions(wallet_address);
CREATE INDEX idx_poker_txns_type ON poker_transactions(type);

-- RLS: service role only (server-side access)
ALTER TABLE poker_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE poker_transactions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "service_role_all" ON poker_wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON poker_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON poker_transactions FOR ALL USING (true) WITH CHECK (true);
