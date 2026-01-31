-- Autonomous Agent System Migration
-- Drops bounty system, adds agent roles and escalation support
-- Agents work autonomously, only escalate to governance when blocked

-- =============================================
-- 1. ADD AGENT ROLES TO factory_users
-- =============================================

ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS agent_role TEXT
CHECK (agent_role IS NULL OR agent_role IN (
    'app_builder',
    'app_refiner',
    'content_creator',
    'growth_outreach',
    'qa_tester'
));

CREATE INDEX IF NOT EXISTS idx_factory_users_agent_role
    ON factory_users(agent_role)
    WHERE agent_role IS NOT NULL;

-- =============================================
-- 2. ADD ESCALATION COLUMNS TO factory_proposals
-- =============================================

ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS escalation_type TEXT
CHECK (escalation_type IS NULL OR escalation_type IN (
    'needs_db_access',
    'needs_api_key',
    'needs_human_decision',
    'needs_other_agent',
    'blocked_by_error',
    'needs_deployment',
    'needs_credential'
));

ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS escalation_urgency TEXT
CHECK (escalation_urgency IS NULL OR escalation_urgency IN ('low', 'medium', 'high', 'critical'));

ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS what_agent_needs TEXT;
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES factory_users(id);

CREATE INDEX IF NOT EXISTS idx_factory_proposals_escalation_type
    ON factory_proposals(escalation_type)
    WHERE escalation_type IS NOT NULL;

-- =============================================
-- 3. DROP BOUNTY SYSTEM
-- =============================================

-- Remove bounty_id from factory_proposals first (FK dependency)
ALTER TABLE factory_proposals DROP COLUMN IF EXISTS bounty_id;
DROP INDEX IF EXISTS idx_factory_proposals_bounty;

-- Drop bounty functions and triggers
DROP TRIGGER IF EXISTS swarm_bounties_updated_at ON swarm_bounties;
DROP FUNCTION IF EXISTS update_swarm_bounties_updated_at();
DROP FUNCTION IF EXISTS complete_swarm_bounty(UUID);

-- Drop bounty indexes
DROP INDEX IF EXISTS idx_swarm_bounties_status;
DROP INDEX IF EXISTS idx_swarm_bounties_category;
DROP INDEX IF EXISTS idx_swarm_bounties_claimed_by;

-- Drop RLS policies
DROP POLICY IF EXISTS "Public read swarm_bounties" ON swarm_bounties;

-- Drop the table
DROP TABLE IF EXISTS swarm_bounties CASCADE;
