-- SUITE User Credits Table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT,
    wallet_address TEXT,
    
    -- Credits tracking
    free_actions_used INTEGER DEFAULT 0,
    suite_balance DECIMAL(18,8) DEFAULT 0,
    
    -- Ad tracking
    total_ads_watched INTEGER DEFAULT 0,
    last_ad_watched TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_discord_id ON user_credits(discord_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credits_updated_at
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies (enable row level security)
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (for bot)
CREATE POLICY "Service role has full access" ON user_credits
    FOR ALL USING (true);

-- Constants (can be changed anytime!)
COMMENT ON TABLE user_credits IS 'FREE_TIER_LIMIT: 20 actions';
