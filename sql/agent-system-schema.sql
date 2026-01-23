-- SUITE Autonomous Agent System - Database Schema
-- Adds agent capabilities to the factory governance system

-- =============================================
-- AGENT COLUMNS ON factory_users
-- =============================================

-- Mark user as an autonomous agent
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS is_agent BOOLEAN DEFAULT false;

-- Unique agent identifier (e.g., "foodvitals-agent")
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS agent_slug TEXT UNIQUE;

-- Secret API key for agent authentication
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS agent_api_key TEXT UNIQUE;

-- The app this agent "owns" and promotes
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS owned_app_slug TEXT;

-- Agent's mission statement (from telos-objective.md)
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS telos_objective TEXT;

-- Current agent status: idle, waiting (for response), working
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS agent_status TEXT DEFAULT 'idle';

-- Reference to most recent proposal
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS last_proposal_id UUID REFERENCES factory_proposals(id) ON DELETE SET NULL;

-- Agent statistics
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS proposals_submitted INTEGER DEFAULT 0;
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS proposals_approved INTEGER DEFAULT 0;
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS proposals_rejected INTEGER DEFAULT 0;

-- Last wake timestamp
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS last_wake_at TIMESTAMP WITH TIME ZONE;

-- Add status constraint for agents
ALTER TABLE factory_users DROP CONSTRAINT IF EXISTS factory_users_agent_status_check;
ALTER TABLE factory_users
ADD CONSTRAINT factory_users_agent_status_check
CHECK (agent_status IS NULL OR agent_status IN ('idle', 'waiting', 'working'));

-- Index for agent queries
CREATE INDEX IF NOT EXISTS idx_factory_users_is_agent ON factory_users(is_agent) WHERE is_agent = true;
CREATE INDEX IF NOT EXISTS idx_factory_users_agent_slug ON factory_users(agent_slug) WHERE agent_slug IS NOT NULL;

-- =============================================
-- AGENT FEEDBACK COLUMNS ON factory_proposals
-- =============================================

-- Feedback text provided when responding to agent proposal
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS agent_feedback TEXT;

-- When feedback was provided
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMP WITH TIME ZONE;

-- Mark if proposal came from an agent (denormalized for easier queries)
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS from_agent BOOLEAN DEFAULT false;

-- Index for agent proposals
CREATE INDEX IF NOT EXISTS idx_factory_proposals_from_agent ON factory_proposals(from_agent) WHERE from_agent = true;

-- =============================================
-- AGENT WAKE LOG TABLE
-- =============================================
-- Track every time an agent wakes up for debugging/auditing

CREATE TABLE IF NOT EXISTS agent_wake_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES factory_users(id) ON DELETE CASCADE,
    wake_reason TEXT, -- 'scheduled', 'manual', 'feedback_received'
    proposal_generated UUID REFERENCES factory_proposals(id) ON DELETE SET NULL,
    state_before JSONB, -- snapshot of state.json before wake
    state_after JSONB, -- snapshot of state.json after wake
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_wake_log_agent ON agent_wake_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_wake_log_created ON agent_wake_log(created_at DESC);

-- RLS for wake log
ALTER TABLE agent_wake_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read agent_wake_log" ON agent_wake_log;
CREATE POLICY "Public read agent_wake_log" ON agent_wake_log FOR SELECT USING (true);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Update agent stats when proposal status changes
CREATE OR REPLACE FUNCTION update_agent_proposal_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_author_is_agent BOOLEAN;
BEGIN
    -- Check if the proposal author is an agent
    SELECT is_agent INTO v_author_is_agent
    FROM factory_users
    WHERE id = NEW.author_id;

    -- Only update stats if author is an agent
    IF v_author_is_agent = TRUE THEN
        -- If status changed to passed/implemented
        IF (NEW.status IN ('passed', 'implemented') AND OLD.status NOT IN ('passed', 'implemented')) THEN
            UPDATE factory_users
            SET proposals_approved = proposals_approved + 1,
                agent_status = 'idle'
            WHERE id = NEW.author_id;
        -- If status changed to rejected
        ELSIF (NEW.status = 'rejected' AND OLD.status != 'rejected') THEN
            UPDATE factory_users
            SET proposals_rejected = proposals_rejected + 1,
                agent_status = 'idle'
            WHERE id = NEW.author_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_agent_stats ON factory_proposals;
CREATE TRIGGER trigger_update_agent_stats
    AFTER UPDATE ON factory_proposals
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_agent_proposal_stats();

-- Function to register a new agent
CREATE OR REPLACE FUNCTION register_agent(
    p_agent_slug TEXT,
    p_owned_app_slug TEXT,
    p_display_name TEXT,
    p_telos_objective TEXT
)
RETURNS UUID AS $$
DECLARE
    v_agent_id UUID;
    v_api_key TEXT;
BEGIN
    -- Generate a random API key
    v_api_key := 'agent_' || encode(gen_random_bytes(24), 'hex');

    -- Create the agent user
    INSERT INTO factory_users (
        display_name,
        is_agent,
        agent_slug,
        agent_api_key,
        owned_app_slug,
        telos_objective,
        agent_status,
        reputation
    ) VALUES (
        p_display_name,
        TRUE,
        p_agent_slug,
        v_api_key,
        p_owned_app_slug,
        p_telos_objective,
        'idle',
        100 -- Starting reputation for agents
    )
    RETURNING id INTO v_agent_id;

    -- Log initial reputation
    INSERT INTO factory_rep_history (user_id, amount, reason)
    VALUES (v_agent_id, 100, 'agent_created');

    RETURN v_agent_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEED FIRST AGENT: FoodVitals
-- =============================================
-- Run manually after creating schema:
/*
SELECT register_agent(
    'foodvitals-agent',
    'foodvitals',
    'FoodVitals Agent',
    'Grow FoodVitals to 10,000 monthly active users and establish it as the go-to food label scanning app in the SUITE ecosystem.'
);

-- Then retrieve the API key:
SELECT agent_api_key FROM factory_users WHERE agent_slug = 'foodvitals-agent';
*/
