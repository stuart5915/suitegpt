-- OddsClaw Prediction Markets

-- Markets table
CREATE TABLE IF NOT EXISTS oddsclaw_markets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    question TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'custom',

    -- Resolution
    resolution_type TEXT NOT NULL DEFAULT 'creator',
    resolution_source TEXT,
    resolution_criteria TEXT,
    resolution_target NUMERIC,
    resolution_comparator TEXT,
    resolved_outcome TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,

    -- Timing
    close_time TIMESTAMPTZ NOT NULL,
    resolution_time TIMESTAMPTZ NOT NULL,
    dispute_deadline TIMESTAMPTZ,

    -- Pool state (constant product AMM)
    yes_pool NUMERIC NOT NULL DEFAULT 1000,
    no_pool NUMERIC NOT NULL DEFAULT 1000,
    total_volume NUMERIC NOT NULL DEFAULT 0,
    liquidity_odds NUMERIC NOT NULL DEFAULT 0,

    -- Creator
    creator_wallet TEXT NOT NULL,
    creation_fee_odds NUMERIC NOT NULL DEFAULT 0,

    -- Meta
    featured BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'active',
    image_url TEXT,
    tags TEXT[] DEFAULT '{}',
    trade_count INTEGER DEFAULT 0,
    unique_traders INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oddsclaw_markets_status ON oddsclaw_markets(status);
CREATE INDEX IF NOT EXISTS idx_oddsclaw_markets_category ON oddsclaw_markets(category);
CREATE INDEX IF NOT EXISTS idx_oddsclaw_markets_close_time ON oddsclaw_markets(close_time);
CREATE INDEX IF NOT EXISTS idx_oddsclaw_markets_creator ON oddsclaw_markets(creator_wallet);

-- User positions
CREATE TABLE IF NOT EXISTS oddsclaw_positions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    market_id UUID NOT NULL REFERENCES oddsclaw_markets(id),
    wallet_address TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
    shares NUMERIC NOT NULL DEFAULT 0,
    avg_price NUMERIC NOT NULL DEFAULT 0,
    total_cost NUMERIC NOT NULL DEFAULT 0,
    realized_pnl NUMERIC NOT NULL DEFAULT 0,
    claimed BOOLEAN DEFAULT false,
    claimed_amount NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(market_id, wallet_address, side)
);

CREATE INDEX IF NOT EXISTS idx_oddsclaw_positions_wallet ON oddsclaw_positions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_oddsclaw_positions_market ON oddsclaw_positions(market_id);

-- Trade history
CREATE TABLE IF NOT EXISTS oddsclaw_trades (
    id BIGSERIAL PRIMARY KEY,
    market_id UUID NOT NULL REFERENCES oddsclaw_markets(id),
    wallet_address TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('yes', 'no')),
    direction TEXT NOT NULL CHECK (direction IN ('buy', 'sell')),
    shares NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    odds_amount NUMERIC NOT NULL,
    fee_odds NUMERIC NOT NULL DEFAULT 0,
    yes_pool_after NUMERIC NOT NULL,
    no_pool_after NUMERIC NOT NULL,
    is_agent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oddsclaw_trades_market ON oddsclaw_trades(market_id);
CREATE INDEX IF NOT EXISTS idx_oddsclaw_trades_wallet ON oddsclaw_trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_oddsclaw_trades_created ON oddsclaw_trades(created_at);

-- Disputes
CREATE TABLE IF NOT EXISTS oddsclaw_disputes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    market_id UUID NOT NULL REFERENCES oddsclaw_markets(id),
    disputer_wallet TEXT NOT NULL,
    stake_odds NUMERIC NOT NULL,
    reason TEXT NOT NULL,
    proposed_outcome TEXT NOT NULL CHECK (proposed_outcome IN ('yes', 'no', 'void')),
    status TEXT NOT NULL DEFAULT 'open',
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wallet balances (off-chain, like poker)
CREATE TABLE IF NOT EXISTS oddsclaw_wallets (
    wallet_address TEXT PRIMARY KEY,
    odds_balance NUMERIC NOT NULL DEFAULT 0 CHECK (odds_balance >= 0),
    total_deposited NUMERIC NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard cache
CREATE TABLE IF NOT EXISTS oddsclaw_leaderboard (
    wallet_address TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    total_volume NUMERIC DEFAULT 0,
    total_pnl NUMERIC DEFAULT 0,
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    markets_created INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE oddsclaw_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE oddsclaw_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE oddsclaw_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE oddsclaw_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oddsclaw_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE oddsclaw_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON oddsclaw_markets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_disputes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_wallets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_leaderboard FOR ALL USING (true) WITH CHECK (true);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_oddsclaw_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_oddsclaw_markets_updated BEFORE UPDATE ON oddsclaw_markets
    FOR EACH ROW EXECUTE FUNCTION update_oddsclaw_updated_at();
CREATE TRIGGER trg_oddsclaw_positions_updated BEFORE UPDATE ON oddsclaw_positions
    FOR EACH ROW EXECUTE FUNCTION update_oddsclaw_updated_at();
CREATE TRIGGER trg_oddsclaw_wallets_updated BEFORE UPDATE ON oddsclaw_wallets
    FOR EACH ROW EXECUTE FUNCTION update_oddsclaw_updated_at();
