-- SUITE Governance Tables
-- Run this in Supabase SQL Editor

-- Proposals table
CREATE TABLE IF NOT EXISTS proposals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'feature', -- treasury, feature, charity, other
    author_wallet TEXT NOT NULL,
    author_name TEXT,
    status TEXT NOT NULL DEFAULT 'idea', -- idea, voting, approved, rejected, shipped
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    yes_votes NUMERIC DEFAULT 0, -- Total SUITE weight for YES
    no_votes NUMERIC DEFAULT 0,  -- Total SUITE weight for NO
    total_voters INTEGER DEFAULT 0 -- Count of unique voters
);

-- Votes table (tracks individual votes)
CREATE TABLE IF NOT EXISTS proposal_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    vote TEXT NOT NULL, -- 'yes' or 'no'
    weight NUMERIC NOT NULL, -- SUITE balance at time of vote
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, wallet_address) -- One vote per wallet per proposal
);

-- Comments table (optional, for discussion)
CREATE TABLE IF NOT EXISTS proposal_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_comments ENABLE ROW LEVEL SECURITY;

-- Policies: Everyone can read, authenticated can write
CREATE POLICY "Anyone can read proposals" ON proposals FOR SELECT USING (true);
CREATE POLICY "Anyone can create proposals" ON proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update proposals" ON proposals FOR UPDATE USING (true);

CREATE POLICY "Anyone can read votes" ON proposal_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can create votes" ON proposal_votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read comments" ON proposal_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can create comments" ON proposal_comments FOR INSERT WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal ON proposal_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_comments_proposal ON proposal_comments(proposal_id);
