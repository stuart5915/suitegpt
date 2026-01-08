-- Enhanced Governance Tables
-- Run this in Supabase SQL Editor (AFTER running supabase-governance.sql)

-- ═══════════════════════════════════════════════════════
-- 1. COUNCIL MEMBERS (exempt from costs, can move proposals)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS council_members (
    wallet_address TEXT PRIMARY KEY,
    name TEXT,
    role TEXT DEFAULT 'Council',
    added_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- 2. USER GOVERNANCE PROFILES (points, stats)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS governance_profiles (
    wallet_address TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    ideas_submitted INTEGER DEFAULT 0,
    ideas_approved INTEGER DEFAULT 0,
    ideas_shipped INTEGER DEFAULT 0,
    votes_cast INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- 3. GOVERNANCE ACTIONS LOG (for tracking/auditing)
-- ═══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS governance_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    action_type TEXT NOT NULL, -- 'create_proposal', 'vote', 'approve', 'ship'
    proposal_id UUID REFERENCES proposals(id),
    points_earned INTEGER DEFAULT 0,
    suite_cost NUMERIC DEFAULT 0,
    signature TEXT, -- For vote verification
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════
-- 4. UPDATE PROPOSAL_VOTES TO INCLUDE SIGNATURE
-- ═══════════════════════════════════════════════════════
ALTER TABLE proposal_votes ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE proposal_votes ADD COLUMN IF NOT EXISTS signed_message TEXT;

-- ═══════════════════════════════════════════════════════
-- 5. UPDATE PROPOSALS TO TRACK COUNCIL ACTIONS
-- ═══════════════════════════════════════════════════════
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS shipped_by TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS suite_cost_paid NUMERIC DEFAULT 0;

-- ═══════════════════════════════════════════════════════
-- 6. ENABLE RLS
-- ═══════════════════════════════════════════════════════
ALTER TABLE council_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_actions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read council" ON council_members FOR SELECT USING (true);
CREATE POLICY "Anyone can read profiles" ON governance_profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can upsert profiles" ON governance_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON governance_profiles FOR UPDATE USING (true);
CREATE POLICY "Anyone can read actions" ON governance_actions FOR SELECT USING (true);
CREATE POLICY "Anyone can log actions" ON governance_actions FOR INSERT WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- 7. GOVERNANCE RANKS (based on points)
-- ═══════════════════════════════════════════════════════
-- 0-99: Newcomer
-- 100-499: Contributor  
-- 500-1999: Active Member
-- 2000-4999: Power Voter
-- 5000+: Governance Legend

-- Function to get rank from points
CREATE OR REPLACE FUNCTION get_governance_rank(points INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF points >= 5000 THEN RETURN 'Legend';
    ELSIF points >= 2000 THEN RETURN 'Power Voter';
    ELSIF points >= 500 THEN RETURN 'Active Member';
    ELSIF points >= 100 THEN RETURN 'Contributor';
    ELSE RETURN 'Newcomer';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════
-- 8. ADD YOUR WALLET AS COUNCIL MEMBER
-- Replace the wallet address below with your actual wallet!
-- ═══════════════════════════════════════════════════════
INSERT INTO council_members (wallet_address, name, role) VALUES 
    ('0xYOUR_WALLET_ADDRESS_HERE', 'Founder', 'Lead')
ON CONFLICT (wallet_address) DO NOTHING;
