-- SUITE Credits System - Supabase Migration
-- Run this in your Supabase SQL Editor

-- =====================================================
-- 1. Users Table (Discord ↔ Wallet link)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    discord_id TEXT PRIMARY KEY,
    wallet_address TEXT UNIQUE,
    username TEXT,
    linked_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. Suite Credits Table (Off-chain credit balance)
-- =====================================================
CREATE TABLE IF NOT EXISTS suite_credits (
    discord_id TEXT PRIMARY KEY REFERENCES users(discord_id),
    credits INTEGER DEFAULT 0,
    free_commands_used INTEGER DEFAULT 0,
    lifetime_credits_loaded INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE suite_credits ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. Command Usage Table (Analytics/billing)
-- =====================================================
CREATE TABLE IF NOT EXISTS command_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_id TEXT REFERENCES users(discord_id),
    command TEXT NOT NULL,
    credits_cost INTEGER NOT NULL,
    app_slug TEXT,
    prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS  
ALTER TABLE command_usage ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. Welcome Bonus Trigger (100 free credits on link)
-- =====================================================
CREATE OR REPLACE FUNCTION give_welcome_bonus()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO suite_credits (discord_id, credits)
    VALUES (NEW.discord_id, 100)
    ON CONFLICT (discord_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_wallet_link ON users;
CREATE TRIGGER on_wallet_link
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION give_welcome_bonus();

-- =====================================================
-- 5. Add pricing tiers to apps table (if not exists)
-- =====================================================
ALTER TABLE apps 
ADD COLUMN IF NOT EXISTS free_features JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS pro_features JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS pro_price INTEGER DEFAULT 10;

-- =====================================================
-- 6. Helper function to deduct credits
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_credits(
    p_discord_id TEXT,
    p_command TEXT,
    p_cost INTEGER,
    p_app_slug TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    current_credits INTEGER;
BEGIN
    -- Get current credits
    SELECT credits INTO current_credits 
    FROM suite_credits 
    WHERE discord_id = p_discord_id;
    
    -- Check sufficient balance
    IF current_credits IS NULL OR current_credits < p_cost THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct credits
    UPDATE suite_credits 
    SET credits = credits - p_cost,
        updated_at = now()
    WHERE discord_id = p_discord_id;
    
    -- Log usage
    INSERT INTO command_usage (discord_id, command, credits_cost, app_slug)
    VALUES (p_discord_id, p_command, p_cost, p_app_slug);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Done! Your credits system is ready.
-- =====================================================
