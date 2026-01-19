-- getSuite Factory - Community Governance System
-- Public feature requests, voting, and DAO-ready reputation system

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS factory_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT UNIQUE,
    wallet_address TEXT UNIQUE,
    display_name TEXT,
    reputation INTEGER DEFAULT 0,
    is_founder BOOLEAN DEFAULT FALSE,
    active_submissions INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for auth lookups
CREATE INDEX IF NOT EXISTS idx_factory_users_telegram ON factory_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_factory_users_wallet ON factory_users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_factory_users_reputation ON factory_users(reputation DESC);

-- =============================================
-- PROPOSALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS factory_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'submitted',
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    total_rep_voted INTEGER DEFAULT 0,
    voting_ends_at TIMESTAMP WITH TIME ZONE,
    reject_reason TEXT,
    implemented_note TEXT,
    app_target TEXT, -- which SUITE app this relates to (optional)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Category constraint
ALTER TABLE factory_proposals DROP CONSTRAINT IF EXISTS factory_proposals_category_check;
ALTER TABLE factory_proposals
ADD CONSTRAINT factory_proposals_category_check
CHECK (category IN ('feature', 'bug', 'app_idea', 'improvement', 'docs', 'integration', 'tokenomics'));

-- Status constraint
ALTER TABLE factory_proposals DROP CONSTRAINT IF EXISTS factory_proposals_status_check;
ALTER TABLE factory_proposals
ADD CONSTRAINT factory_proposals_status_check
CHECK (status IN ('submitted', 'open_voting', 'passed', 'rejected', 'implemented', 'duplicate'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factory_proposals_status ON factory_proposals(status);
CREATE INDEX IF NOT EXISTS idx_factory_proposals_author ON factory_proposals(author_id);
CREATE INDEX IF NOT EXISTS idx_factory_proposals_created ON factory_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_proposals_voting_ends ON factory_proposals(voting_ends_at);

-- =============================================
-- VOTES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS factory_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES factory_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES factory_users(id) ON DELETE CASCADE,
    vote_direction INTEGER NOT NULL, -- 1 for, -1 against
    vote_power INTEGER NOT NULL DEFAULT 1, -- how many votes (quadratic)
    rep_spent INTEGER NOT NULL DEFAULT 0, -- rep cost for quadratic voting
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proposal_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factory_votes_proposal ON factory_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_factory_votes_user ON factory_votes(user_id);

-- =============================================
-- REP HISTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS factory_rep_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES factory_users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    proposal_id UUID REFERENCES factory_proposals(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reason types: 'vote_cast', 'submission_accepted', 'submission_rejected',
--               'treasury_deposit', 'referral', 'decay', 'founder_bonus'

CREATE INDEX IF NOT EXISTS idx_factory_rep_history_user ON factory_rep_history(user_id);
CREATE INDEX IF NOT EXISTS idx_factory_rep_history_created ON factory_rep_history(created_at DESC);

-- =============================================
-- COMMENTS TABLE (for proposal discussions)
-- =============================================
CREATE TABLE IF NOT EXISTS factory_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES factory_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_comments_proposal ON factory_comments(proposal_id);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE factory_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_rep_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE factory_comments ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "Public read factory_users" ON factory_users FOR SELECT USING (true);
CREATE POLICY "Public read factory_proposals" ON factory_proposals FOR SELECT USING (true);
CREATE POLICY "Public read factory_votes" ON factory_votes FOR SELECT USING (true);
CREATE POLICY "Public read factory_rep_history" ON factory_rep_history FOR SELECT USING (true);
CREATE POLICY "Public read factory_comments" ON factory_comments FOR SELECT USING (true);

-- Write access (handled by edge functions with service role)
CREATE POLICY "Service write factory_users" ON factory_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write factory_proposals" ON factory_proposals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write factory_votes" ON factory_votes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write factory_rep_history" ON factory_rep_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service write factory_comments" ON factory_comments FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Calculate quadratic voting cost: cost(n) = n * (n-1) / 2
CREATE OR REPLACE FUNCTION calculate_vote_cost(vote_count INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF vote_count <= 1 THEN
        RETURN 0; -- First vote is free
    END IF;
    RETURN (vote_count * (vote_count - 1)) / 2;
END;
$$ LANGUAGE plpgsql;

-- Update proposal vote counts (called after vote insert/update)
CREATE OR REPLACE FUNCTION update_proposal_votes()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE factory_proposals
    SET
        votes_for = (SELECT COALESCE(SUM(vote_power), 0) FROM factory_votes WHERE proposal_id = NEW.proposal_id AND vote_direction = 1),
        votes_against = (SELECT COALESCE(SUM(vote_power), 0) FROM factory_votes WHERE proposal_id = NEW.proposal_id AND vote_direction = -1),
        total_rep_voted = (SELECT COALESCE(SUM(rep_spent), 0) FROM factory_votes WHERE proposal_id = NEW.proposal_id)
    WHERE id = NEW.proposal_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proposal_votes ON factory_votes;
CREATE TRIGGER trigger_update_proposal_votes
    AFTER INSERT OR UPDATE ON factory_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_proposal_votes();

-- Update user last_active_at
CREATE OR REPLACE FUNCTION update_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE factory_users SET last_active_at = NOW() WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_activity_on_vote ON factory_votes;
CREATE TRIGGER trigger_update_activity_on_vote
    AFTER INSERT ON factory_votes
    FOR EACH ROW
    EXECUTE FUNCTION update_user_activity();

-- Auto-update updated_at on proposals
CREATE OR REPLACE FUNCTION update_proposal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proposal_timestamp ON factory_proposals;
CREATE TRIGGER trigger_update_proposal_timestamp
    BEFORE UPDATE ON factory_proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_proposal_timestamp();

-- =============================================
-- SEED FOUNDER ACCOUNT
-- =============================================
-- Run this manually after creating tables:
-- INSERT INTO factory_users (display_name, is_founder, reputation)
-- VALUES ('Stuart', TRUE, 1000);
--
-- INSERT INTO factory_rep_history (user_id, amount, reason)
-- SELECT id, 1000, 'founder_bonus' FROM factory_users WHERE is_founder = TRUE;
