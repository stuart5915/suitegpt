-- Mirror Vault Marketplace tables
-- Stores off-chain metadata + cached metrics for mirror vaults

CREATE TABLE IF NOT EXISTS mirror_vault_marketplace (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vault_address TEXT NOT NULL UNIQUE,
    creator_address TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    performance_fee_bps INTEGER DEFAULT 0,
    deposit_cap_usdc NUMERIC DEFAULT 0,

    -- Tracked position info
    tracked_wallet TEXT NOT NULL,
    tracked_token_id TEXT DEFAULT '0',

    -- Cached on-chain metrics (keeper updates)
    tvl_usdc NUMERIC DEFAULT 0,
    share_price NUMERIC DEFAULT 1.0,
    mirror_count INTEGER DEFAULT 0,
    last_mirror_time TIMESTAMPTZ,
    is_in_range BOOLEAN DEFAULT false,
    needs_mirror BOOLEAN DEFAULT false,
    idle_usdc NUMERIC DEFAULT 0,

    -- Tracked position stats (on-chain + Basescan derived)
    tracked_position_value_usdc NUMERIC DEFAULT 0,
    tracked_position_tick_lower INTEGER DEFAULT 0,
    tracked_position_tick_upper INTEGER DEFAULT 0,
    tracked_position_range_low_usd NUMERIC DEFAULT 0,
    tracked_position_range_high_usd NUMERIC DEFAULT 0,
    tracked_position_age_days INTEGER DEFAULT 0,
    tracked_position_staked BOOLEAN DEFAULT false,
    tracked_wallet_total_positions INTEGER DEFAULT 0,
    tracked_wallet_first_lp_date TIMESTAMPTZ,
    uncollected_fees_usdc NUMERIC DEFAULT 0,

    -- Performance (from snapshots)
    estimated_apy NUMERIC DEFAULT 0,
    return_7d NUMERIC DEFAULT 0,
    return_30d NUMERIC DEFAULT 0,

    -- Curation staking
    basis_staked NUMERIC DEFAULT 0,

    -- BASIS burned to create this vault
    basis_burned NUMERIC DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mirror_vault_creator ON mirror_vault_marketplace(creator_address);
CREATE INDEX idx_mirror_vault_tracked ON mirror_vault_marketplace(tracked_wallet);
CREATE INDEX idx_mirror_vault_tvl ON mirror_vault_marketplace(tvl_usdc DESC);
CREATE INDEX idx_mirror_vault_apy ON mirror_vault_marketplace(estimated_apy DESC);
CREATE INDEX idx_mirror_vault_staked ON mirror_vault_marketplace(basis_staked DESC);

-- Historical snapshots for performance charts
CREATE TABLE IF NOT EXISTS mirror_vault_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vault_address TEXT NOT NULL REFERENCES mirror_vault_marketplace(vault_address),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    tvl_usdc NUMERIC DEFAULT 0,
    share_price NUMERIC DEFAULT 1.0,
    is_in_range BOOLEAN DEFAULT false,
    eth_price NUMERIC DEFAULT 0,
    tick_lower INTEGER DEFAULT 0,
    tick_upper INTEGER DEFAULT 0
);

CREATE INDEX idx_mirror_snapshots_vault ON mirror_vault_snapshots(vault_address, timestamp DESC);

-- Enable RLS
ALTER TABLE mirror_vault_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror_vault_snapshots ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can read mirror vaults" ON mirror_vault_marketplace FOR SELECT USING (true);
CREATE POLICY "Anyone can read mirror snapshots" ON mirror_vault_snapshots FOR SELECT USING (true);

-- Service role writes
CREATE POLICY "Service role insert mirror vaults" ON mirror_vault_marketplace FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role update mirror vaults" ON mirror_vault_marketplace FOR UPDATE USING (true);
CREATE POLICY "Service role insert mirror snapshots" ON mirror_vault_snapshots FOR INSERT WITH CHECK (true);
