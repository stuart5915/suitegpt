-- =====================================================
-- SUITE Referral System
-- Tracks referrals and awards credits when referee deposits
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Create referrals table
CREATE TABLE IF NOT EXISTS referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_discord_id TEXT NOT NULL,           -- who shared the link
    referrer_wallet TEXT,                         -- referrer's wallet (optional)
    referee_wallet TEXT NOT NULL UNIQUE,          -- who deposited (unique = can only be referred once)
    referee_discord_id TEXT,                      -- referee's Discord if known
    deposit_amount DECIMAL(18,6) DEFAULT 0,       -- total deposited by referee
    reward_earned DECIMAL(18,4) DEFAULT 0,        -- credits earned by referrer
    reward_claimed BOOLEAN DEFAULT FALSE,         -- has referrer received credits?
    status TEXT DEFAULT 'pending',                -- pending, qualified, paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    qualified_at TIMESTAMP WITH TIME ZONE,        -- when deposit threshold met
    CONSTRAINT no_self_referral CHECK (referrer_wallet != referee_wallet)
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_discord_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- 3. Disable RLS for now (public read on referral stats)
ALTER TABLE referrals DISABLE ROW LEVEL SECURITY;

-- 4. Function to register a referral (when referee visits with ref code)
CREATE OR REPLACE FUNCTION register_referral(
    p_referrer_id TEXT,
    p_referee_wallet TEXT,
    p_referee_discord_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Don't allow if referee already exists
    IF EXISTS (SELECT 1 FROM referrals WHERE referee_wallet = p_referee_wallet) THEN
        RETURN FALSE; -- Already referred by someone
    END IF;
    
    -- Don't allow self-referral
    IF p_referrer_id = p_referee_discord_id THEN
        RETURN FALSE;
    END IF;
    
    INSERT INTO referrals (referrer_discord_id, referee_wallet, referee_discord_id)
    VALUES (p_referrer_id, p_referee_wallet, p_referee_discord_id);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 5. Function to process deposit and award referral
CREATE OR REPLACE FUNCTION process_referral_deposit(
    p_referee_wallet TEXT,
    p_deposit_usd DECIMAL(18,6)
)
RETURNS TABLE(referrer_id TEXT, reward DECIMAL) AS $$
DECLARE
    v_referrer_id TEXT;
    v_current_deposit DECIMAL;
    v_new_deposit DECIMAL;
    v_reward DECIMAL := 0;
BEGIN
    -- Find if this wallet was referred
    SELECT referrer_discord_id, deposit_amount INTO v_referrer_id, v_current_deposit
    FROM referrals 
    WHERE referee_wallet = p_referee_wallet AND status = 'pending';
    
    IF v_referrer_id IS NULL THEN
        RETURN; -- Not a referred user
    END IF;
    
    v_new_deposit := v_current_deposit + p_deposit_usd;
    
    -- Calculate reward based on tier (only triggers once when crossing $5)
    IF v_current_deposit < 5 AND v_new_deposit >= 5 THEN
        -- Determine reward tier based on total deposit
        IF v_new_deposit >= 50 THEN
            v_reward := 50;
        ELSIF v_new_deposit >= 10 THEN
            v_reward := 25;
        ELSE
            v_reward := 10;
        END IF;
        
        -- Update referral record
        UPDATE referrals 
        SET deposit_amount = v_new_deposit,
            reward_earned = v_reward,
            status = 'qualified',
            qualified_at = NOW()
        WHERE referee_wallet = p_referee_wallet;
        
        -- Add credits to referrer
        PERFORM add_user_credits(v_referrer_id, NULL, v_reward);
        
        referrer_id := v_referrer_id;
        reward := v_reward;
        RETURN NEXT;
    ELSE
        -- Just update deposit amount
        UPDATE referrals 
        SET deposit_amount = v_new_deposit
        WHERE referee_wallet = p_referee_wallet;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 6. Function to get referral stats for a user
CREATE OR REPLACE FUNCTION get_referral_stats(p_discord_id TEXT)
RETURNS TABLE(
    total_referred BIGINT,
    total_qualified BIGINT,
    total_earned DECIMAL,
    referrals JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_referred,
        COUNT(*) FILTER (WHERE r.status = 'qualified')::BIGINT as total_qualified,
        COALESCE(SUM(r.reward_earned), 0) as total_earned,
        COALESCE(
            json_agg(
                json_build_object(
                    'wallet', LEFT(r.referee_wallet, 6) || '...' || RIGHT(r.referee_wallet, 4),
                    'deposited', r.deposit_amount,
                    'reward', r.reward_earned,
                    'status', r.status,
                    'date', r.created_at
                ) ORDER BY r.created_at DESC
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'::json
        ) as referrals
    FROM referrals r
    WHERE r.referrer_discord_id = p_discord_id;
END;
$$ LANGUAGE plpgsql;
