-- =====================================================
-- SUITE Proposals Table - Create Table First!
-- Run this BEFORE running supabase-seed-proposals.sql
-- =====================================================

-- 1. Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'other', -- treasury, feature, charity, other
    author_wallet TEXT NOT NULL,
    status TEXT DEFAULT 'idea', -- idea, voting, approved, shipped
    yes_votes DECIMAL(18,4) DEFAULT 0,
    no_votes DECIMAL(18,4) DEFAULT 0,
    total_voters INTEGER DEFAULT 0,
    snapshot_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_category ON proposals(category);
CREATE INDEX IF NOT EXISTS idx_proposals_author ON proposals(author_wallet);

-- 3. Enable RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Anyone can read proposals
CREATE POLICY "Anyone can view proposals" ON proposals
    FOR SELECT USING (true);

-- Allow inserts for authenticated users
CREATE POLICY "Users can create proposals" ON proposals
    FOR INSERT WITH CHECK (true);

-- Allow updates (for vote counts)
CREATE POLICY "Anyone can update proposal votes" ON proposals
    FOR UPDATE USING (true);

-- 5. Create proposal_votes table for tracking individual votes
CREATE TABLE IF NOT EXISTS proposal_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    vote TEXT NOT NULL, -- 'yes' or 'no'
    weight DECIMAL(18,4) DEFAULT 0,
    signature TEXT,
    signed_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proposal_id, wallet_address)
);

-- 6. Create governance_profiles table
CREATE TABLE IF NOT EXISTS governance_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    points INTEGER DEFAULT 0,
    ideas_submitted INTEGER DEFAULT 0,
    votes_cast INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create council_members table
CREATE TABLE IF NOT EXISTS council_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL UNIQUE,
    name TEXT,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on these too
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_members ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Anyone can view votes" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "Users can create votes" ON proposal_votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view profiles" ON governance_profiles FOR SELECT USING (true);
CREATE POLICY "Users can create profiles" ON governance_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update profiles" ON governance_profiles FOR UPDATE USING (true);

CREATE POLICY "Anyone can view council" ON council_members FOR SELECT USING (true);
