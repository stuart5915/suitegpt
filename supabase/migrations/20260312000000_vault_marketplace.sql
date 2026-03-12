-- Vault Marketplace tables
-- Stores off-chain metadata for marketplace vaults

CREATE TABLE IF NOT EXISTS vault_marketplace (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vault_address TEXT NOT NULL UNIQUE,
    manager_address TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    brain_config JSONB DEFAULT '{}',
    config_hash TEXT DEFAULT '',
    performance_fee_bps INTEGER DEFAULT 0,
    deposit_cap_usdc NUMERIC DEFAULT 0,

    -- Cached metrics (updated by keeper/cron)
    tvl_usdc NUMERIC DEFAULT 0,
    total_return_pct NUMERIC DEFAULT 0,
    max_drawdown_pct NUMERIC DEFAULT 0,
    sharpe_ratio NUMERIC DEFAULT 0,
    rebalance_count INTEGER DEFAULT 0,
    share_price NUMERIC DEFAULT 1.0,

    -- Allocation breakdown
    alloc_lp_bps INTEGER DEFAULT 0,
    alloc_long_bps INTEGER DEFAULT 0,
    alloc_short_bps INTEGER DEFAULT 0,
    alloc_hold_bps INTEGER DEFAULT 10000,

    -- Manager info
    manager_name TEXT DEFAULT 'Anonymous',
    manager_avatar_url TEXT DEFAULT '',

    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vault_marketplace_manager ON vault_marketplace(manager_address);
CREATE INDEX idx_vault_marketplace_tvl ON vault_marketplace(tvl_usdc DESC);
CREATE INDEX idx_vault_marketplace_return ON vault_marketplace(total_return_pct DESC);

-- Historical snapshots for performance charts
CREATE TABLE IF NOT EXISTS vault_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vault_address TEXT NOT NULL REFERENCES vault_marketplace(vault_address),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    tvl_usdc NUMERIC DEFAULT 0,
    share_price NUMERIC DEFAULT 1.0,
    total_return_pct NUMERIC DEFAULT 0,
    alloc_lp_bps INTEGER DEFAULT 0,
    alloc_long_bps INTEGER DEFAULT 0,
    alloc_short_bps INTEGER DEFAULT 0,
    alloc_hold_bps INTEGER DEFAULT 10000,
    eth_price NUMERIC DEFAULT 0
);

CREATE INDEX idx_vault_snapshots_vault ON vault_snapshots(vault_address, timestamp DESC);

-- Enable RLS
ALTER TABLE vault_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read vaults" ON vault_marketplace FOR SELECT USING (true);
CREATE POLICY "Anyone can read snapshots" ON vault_snapshots FOR SELECT USING (true);

-- Only service role can write (keeper/API)
CREATE POLICY "Service role can insert vaults" ON vault_marketplace FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role can update vaults" ON vault_marketplace FOR UPDATE USING (true);
CREATE POLICY "Service role can insert snapshots" ON vault_snapshots FOR INSERT WITH CHECK (true);
