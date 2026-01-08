-- SUITE Boost System Tables
-- Run this in your Supabase SQL Editor

-- User Boosts table (inventory of owned boosts)
CREATE TABLE IF NOT EXISTS user_boosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL,
    boost_type TEXT NOT NULL CHECK (boost_type IN ('speed-review', 'ai-pack', 'app-slot', 'featured-week', '2x-earn')),
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ DEFAULT NULL,
    gifted_to TEXT DEFAULT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

-- Boost Transactions (purchase/gift/use history)
CREATE TABLE IF NOT EXISTS boost_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL,
    boost_type TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('purchase', 'gift_sent', 'gift_received', 'used')),
    suite_amount INTEGER DEFAULT 0,
    recipient_discord_id TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE boost_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own boosts" ON user_boosts FOR SELECT USING (true);
CREATE POLICY "Users can insert boosts" ON user_boosts FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own boosts" ON user_boosts FOR UPDATE USING (true);
CREATE POLICY "Users can delete own boosts" ON user_boosts FOR DELETE USING (true);

CREATE POLICY "Users can read transactions" ON boost_transactions FOR SELECT USING (true);
CREATE POLICY "Users can insert transactions" ON boost_transactions FOR INSERT WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_boosts_discord ON user_boosts(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_boosts_type ON user_boosts(boost_type);
CREATE INDEX IF NOT EXISTS idx_boost_transactions_discord ON boost_transactions(discord_id);

-- Grant access
GRANT ALL ON user_boosts TO anon, authenticated;
GRANT ALL ON boost_transactions TO anon, authenticated;

-- Also ensure user_balances table exists (if not already)
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT UNIQUE NOT NULL,
    balance INTEGER DEFAULT 0,
    lifetime_earnings INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read balances" ON user_balances FOR SELECT USING (true);
CREATE POLICY "Anyone can insert balances" ON user_balances FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update balances" ON user_balances FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_user_balances_discord ON user_balances(discord_id);
GRANT ALL ON user_balances TO anon, authenticated;
