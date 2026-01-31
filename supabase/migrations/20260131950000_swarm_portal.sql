-- Swarm Portal Migration
-- Adds bounty system for external agent integration
-- Extends factory_users with credits/wallet columns
-- Creates swarm_bounties table and complete_swarm_bounty() function

-- =============================================
-- EXTEND factory_users FOR SWARM
-- =============================================

ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS total_credits_earned DECIMAL(12,4) DEFAULT 0;
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS owner_wallet TEXT;
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_factory_users_credits_earned
    ON factory_users(total_credits_earned DESC)
    WHERE is_agent = true;

-- =============================================
-- SWARM BOUNTIES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS swarm_bounties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('feature', 'bugfix', 'content', 'marketing', 'data', 'integration')),
    credit_reward DECIMAL(12,4) NOT NULL DEFAULT 100,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled')),
    claimed_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard', 'expert')),
    target_app TEXT,
    created_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_swarm_bounties_status ON swarm_bounties(status);
CREATE INDEX IF NOT EXISTS idx_swarm_bounties_category ON swarm_bounties(category);
CREATE INDEX IF NOT EXISTS idx_swarm_bounties_claimed_by ON swarm_bounties(claimed_by) WHERE claimed_by IS NOT NULL;

-- RLS
ALTER TABLE swarm_bounties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read swarm_bounties" ON swarm_bounties;
CREATE POLICY "Public read swarm_bounties" ON swarm_bounties FOR SELECT USING (true);

-- =============================================
-- ADD bounty_id TO factory_proposals
-- =============================================

ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS bounty_id UUID REFERENCES swarm_bounties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_factory_proposals_bounty ON factory_proposals(bounty_id) WHERE bounty_id IS NOT NULL;

-- =============================================
-- COMPLETE SWARM BOUNTY FUNCTION
-- =============================================
-- Marks bounty done, credits the agent's owner wallet, logs transaction

CREATE OR REPLACE FUNCTION complete_swarm_bounty(p_bounty_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_bounty RECORD;
    v_agent RECORD;
    v_wallet TEXT;
BEGIN
    -- Get the bounty
    SELECT * INTO v_bounty FROM swarm_bounties WHERE id = p_bounty_id;

    IF v_bounty IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bounty not found');
    END IF;

    IF v_bounty.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bounty already completed');
    END IF;

    IF v_bounty.claimed_by IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Bounty not claimed by any agent');
    END IF;

    -- Get the agent
    SELECT * INTO v_agent FROM factory_users WHERE id = v_bounty.claimed_by;

    IF v_agent IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Agent not found');
    END IF;

    -- Determine wallet: agent's owner_wallet or fall back to agent_slug
    v_wallet := COALESCE(v_agent.owner_wallet, LOWER(v_agent.agent_slug));

    -- Mark bounty completed
    UPDATE swarm_bounties
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_bounty_id;

    -- Credit the agent's wallet
    INSERT INTO suite_credits (wallet_address, balance)
    VALUES (v_wallet, 0)
    ON CONFLICT (wallet_address) DO NOTHING;

    UPDATE suite_credits
    SET balance = balance + v_bounty.credit_reward,
        updated_at = NOW()
    WHERE wallet_address = v_wallet;

    -- Log the transaction
    INSERT INTO credit_transactions (wallet_address, amount, type, feature, description)
    VALUES (v_wallet, v_bounty.credit_reward, 'bonus', 'swarm_bounty',
            'Bounty completed: ' || v_bounty.title);

    -- Update agent stats
    UPDATE factory_users
    SET total_credits_earned = COALESCE(total_credits_earned, 0) + v_bounty.credit_reward,
        last_active_at = NOW()
    WHERE id = v_bounty.claimed_by;

    RETURN jsonb_build_object(
        'success', true,
        'credits_awarded', v_bounty.credit_reward,
        'wallet', v_wallet,
        'agent_id', v_bounty.claimed_by
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- UPDATED_AT TRIGGER FOR BOUNTIES
-- =============================================

CREATE OR REPLACE FUNCTION update_swarm_bounties_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS swarm_bounties_updated_at ON swarm_bounties;
CREATE TRIGGER swarm_bounties_updated_at
    BEFORE UPDATE ON swarm_bounties
    FOR EACH ROW
    EXECUTE FUNCTION update_swarm_bounties_updated_at();

-- =============================================
-- SEED TEST BOUNTIES
-- =============================================

INSERT INTO swarm_bounties (title, description, category, credit_reward, difficulty, target_app) VALUES
('Add dark mode to FoodVitals', 'Implement a dark mode toggle for the FoodVitals app. Should respect system preferences and persist user choice.', 'feature', 500, 'medium', 'foodvitals'),
('Write onboarding guide for SuiteGPT', 'Create a step-by-step onboarding article for new users explaining how to navigate the ecosystem, earn credits, and build apps.', 'content', 300, 'easy', NULL),
('Fix mobile nav overflow on Client Hub', 'The navigation menu overflows on small screens (<375px). Investigate and fix the CSS layout issue.', 'bugfix', 200, 'easy', 'client-hub'),
('Build Twitter/X integration for Marketing', 'Create an integration that auto-posts approved marketing proposals to the SUITE Twitter account via API.', 'integration', 1000, 'hard', NULL),
('Scrape and normalize app store data', 'Build a data pipeline that scrapes competitor app listings and normalizes the data into a comparison dataset.', 'data', 750, 'hard', NULL),
('Create referral tracking system', 'Implement referral link generation and tracking so operators can measure which channels drive the most signups.', 'marketing', 600, 'medium', NULL);
