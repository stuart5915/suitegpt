-- =====================================================
-- SUITE User Credits System
-- Tracks earned credits from reviews, referrals, etc.
-- Run this migration in Supabase SQL Editor
-- =====================================================

-- 1. Create user_credits table
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE,
    username TEXT,
    credits DECIMAL(18,4) DEFAULT 0,
    total_earned DECIMAL(18,4) DEFAULT 0,
    total_claimed DECIMAL(18,4) DEFAULT 0,
    wallet_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_discord ON user_credits(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_wallet ON user_credits(wallet_address);

-- 3. Enable RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can read their own credits
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (true);

-- Users can update their own record (for linking wallet)
CREATE POLICY "Users can update own credits" ON user_credits
    FOR UPDATE USING (true);

-- Allow inserts (for creating new user records)
CREATE POLICY "Allow credit inserts" ON user_credits
    FOR INSERT WITH CHECK (true);

-- 5. Function to add credits to a user
CREATE OR REPLACE FUNCTION add_user_credits(
    p_discord_id TEXT,
    p_username TEXT,
    p_amount DECIMAL(18,4)
)
RETURNS void AS $$
BEGIN
    INSERT INTO user_credits (discord_id, username, credits, total_earned)
    VALUES (p_discord_id, p_username, p_amount, p_amount)
    ON CONFLICT (discord_id) 
    DO UPDATE SET 
        credits = user_credits.credits + p_amount,
        total_earned = user_credits.total_earned + p_amount,
        username = COALESCE(p_username, user_credits.username),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger function to auto-add credits when review is submitted
CREATE OR REPLACE FUNCTION add_credits_on_review()
RETURNS TRIGGER AS $$
BEGIN
    -- Only add credits if suite_earned > 0
    IF NEW.suite_earned > 0 THEN
        PERFORM add_user_credits(
            NEW.reviewer_discord_id,
            NEW.reviewer_username,
            NEW.suite_earned
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger on app_reviews
DROP TRIGGER IF EXISTS trigger_add_credits_on_review ON app_reviews;
CREATE TRIGGER trigger_add_credits_on_review
    AFTER INSERT ON app_reviews
    FOR EACH ROW
    EXECUTE FUNCTION add_credits_on_review();

-- 8. Function to claim credits (deduct from balance)
CREATE OR REPLACE FUNCTION claim_credits(
    p_discord_id TEXT,
    p_amount DECIMAL(18,4)
)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits DECIMAL(18,4);
BEGIN
    SELECT credits INTO current_credits FROM user_credits WHERE discord_id = p_discord_id;
    
    IF current_credits IS NULL OR current_credits < p_amount THEN
        RETURN FALSE;
    END IF;
    
    UPDATE user_credits 
    SET credits = credits - p_amount,
        total_claimed = total_claimed + p_amount,
        updated_at = NOW()
    WHERE discord_id = p_discord_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 9. Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_user_credits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_credits_updated ON user_credits;
CREATE TRIGGER trigger_user_credits_updated
    BEFORE UPDATE ON user_credits
    FOR EACH ROW
    EXECUTE FUNCTION update_user_credits_timestamp();
