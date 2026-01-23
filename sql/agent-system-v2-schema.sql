-- SUITE Autonomous Agent System v2 - Execution Mode Schema
-- Adds execution state management and submission types for agents

-- =============================================
-- SUBMISSION TYPES ON factory_proposals
-- =============================================

-- Submission type: proposal, work_update, assistance_request, completion
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS submission_type TEXT DEFAULT 'proposal';

-- For assistance requests: what specific help is needed
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS assistance_needed TEXT;

-- For work updates/completions: link to the parent proposal being executed
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS parent_proposal_id UUID REFERENCES factory_proposals(id) ON DELETE SET NULL;

-- Assistance response from human (for when they provide help)
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS assistance_response TEXT;

-- When assistance was provided
ALTER TABLE factory_proposals ADD COLUMN IF NOT EXISTS assistance_provided_at TIMESTAMP WITH TIME ZONE;

-- Add constraint for submission types
ALTER TABLE factory_proposals DROP CONSTRAINT IF EXISTS factory_proposals_submission_type_check;
ALTER TABLE factory_proposals
ADD CONSTRAINT factory_proposals_submission_type_check
CHECK (submission_type IS NULL OR submission_type IN ('proposal', 'work_update', 'assistance_request', 'completion'));

-- Index for submission types
CREATE INDEX IF NOT EXISTS idx_factory_proposals_submission_type ON factory_proposals(submission_type);
CREATE INDEX IF NOT EXISTS idx_factory_proposals_parent ON factory_proposals(parent_proposal_id) WHERE parent_proposal_id IS NOT NULL;


-- =============================================
-- EXECUTION STATE ON factory_users (agents)
-- =============================================

-- Currently executing proposal (null if idle)
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS current_task_id UUID REFERENCES factory_proposals(id) ON DELETE SET NULL;

-- Execution state: idle, executing, blocked
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS execution_state TEXT DEFAULT 'idle';

-- Update agent_status constraint to include new states
ALTER TABLE factory_users DROP CONSTRAINT IF EXISTS factory_users_agent_status_check;
ALTER TABLE factory_users
ADD CONSTRAINT factory_users_agent_status_check
CHECK (agent_status IS NULL OR agent_status IN ('idle', 'waiting', 'working', 'executing', 'blocked'));

-- Add constraint for execution state
ALTER TABLE factory_users DROP CONSTRAINT IF EXISTS factory_users_execution_state_check;
ALTER TABLE factory_users
ADD CONSTRAINT factory_users_execution_state_check
CHECK (execution_state IS NULL OR execution_state IN ('idle', 'executing', 'blocked'));

-- Index for execution state queries
CREATE INDEX IF NOT EXISTS idx_factory_users_execution_state ON factory_users(execution_state) WHERE is_agent = true;
CREATE INDEX IF NOT EXISTS idx_factory_users_current_task ON factory_users(current_task_id) WHERE current_task_id IS NOT NULL;


-- =============================================
-- AGENT EXECUTION LOG TABLE
-- =============================================
-- Track execution progress, blockers, and completions

CREATE TABLE IF NOT EXISTS agent_execution_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES factory_users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES factory_proposals(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'started', 'progress', 'blocked', 'assistance_received', 'completed'
    event_data JSONB, -- Details about the event (progress %, blocker info, etc.)
    message TEXT, -- Human-readable description
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_log_agent ON agent_execution_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_log_task ON agent_execution_log(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_execution_log_created ON agent_execution_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_execution_log_type ON agent_execution_log(event_type);

-- RLS for execution log
ALTER TABLE agent_execution_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read agent_execution_log" ON agent_execution_log;
CREATE POLICY "Public read agent_execution_log" ON agent_execution_log FOR SELECT USING (true);


-- =============================================
-- AGENT LEARNED PATTERNS TABLE
-- =============================================
-- Store patterns learned from rejected proposals

CREATE TABLE IF NOT EXISTS agent_learned_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES factory_users(id) ON DELETE CASCADE,
    pattern_type TEXT NOT NULL, -- 'too_broad', 'wrong_priority', 'missing_justification', 'out_of_scope', 'successful'
    pattern_text TEXT NOT NULL, -- What to avoid or replicate
    source_proposal_id UUID REFERENCES factory_proposals(id) ON DELETE SET NULL,
    feedback TEXT, -- The feedback that led to learning this pattern
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_learned_patterns_agent ON agent_learned_patterns(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_learned_patterns_type ON agent_learned_patterns(pattern_type);

-- RLS for learned patterns
ALTER TABLE agent_learned_patterns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read agent_learned_patterns" ON agent_learned_patterns;
CREATE POLICY "Public read agent_learned_patterns" ON agent_learned_patterns FOR SELECT USING (true);


-- =============================================
-- HELPER FUNCTIONS FOR v2
-- =============================================

-- Function to start executing an approved proposal
CREATE OR REPLACE FUNCTION start_agent_execution(
    p_agent_id UUID,
    p_proposal_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Update agent state
    UPDATE factory_users
    SET current_task_id = p_proposal_id,
        execution_state = 'executing',
        agent_status = 'working'
    WHERE id = p_agent_id AND is_agent = true;

    -- Log the execution start
    INSERT INTO agent_execution_log (agent_id, task_id, event_type, message)
    VALUES (p_agent_id, p_proposal_id, 'started', 'Agent began executing approved task');
END;
$$ LANGUAGE plpgsql;

-- Function to mark agent as blocked
CREATE OR REPLACE FUNCTION block_agent_execution(
    p_agent_id UUID,
    p_blocker_message TEXT,
    p_assistance_needed TEXT
)
RETURNS UUID AS $$
DECLARE
    v_task_id UUID;
    v_assistance_request_id UUID;
BEGIN
    -- Get current task
    SELECT current_task_id INTO v_task_id
    FROM factory_users
    WHERE id = p_agent_id AND is_agent = true;

    -- Update agent state
    UPDATE factory_users
    SET execution_state = 'blocked',
        agent_status = 'blocked'
    WHERE id = p_agent_id AND is_agent = true;

    -- Log the block
    INSERT INTO agent_execution_log (agent_id, task_id, event_type, message, event_data)
    VALUES (p_agent_id, v_task_id, 'blocked', p_blocker_message, jsonb_build_object('assistance_needed', p_assistance_needed));

    RETURN v_task_id;
END;
$$ LANGUAGE plpgsql;

-- Function to provide assistance to a blocked agent
CREATE OR REPLACE FUNCTION provide_agent_assistance(
    p_assistance_request_id UUID,
    p_assistance_response TEXT
)
RETURNS VOID AS $$
DECLARE
    v_agent_id UUID;
BEGIN
    -- Update the assistance request
    UPDATE factory_proposals
    SET assistance_response = p_assistance_response,
        assistance_provided_at = NOW(),
        status = 'passed'
    WHERE id = p_assistance_request_id AND submission_type = 'assistance_request';

    -- Get the agent ID
    SELECT author_id INTO v_agent_id
    FROM factory_proposals
    WHERE id = p_assistance_request_id;

    -- Update agent state to continue executing
    UPDATE factory_users
    SET execution_state = 'executing',
        agent_status = 'working'
    WHERE id = v_agent_id AND is_agent = true;

    -- Log assistance received
    INSERT INTO agent_execution_log (agent_id, task_id, event_type, message, event_data)
    SELECT v_agent_id, current_task_id, 'assistance_received', 'Human provided assistance',
           jsonb_build_object('response', p_assistance_response)
    FROM factory_users
    WHERE id = v_agent_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete agent execution
CREATE OR REPLACE FUNCTION complete_agent_execution(
    p_agent_id UUID,
    p_completion_message TEXT
)
RETURNS VOID AS $$
DECLARE
    v_task_id UUID;
BEGIN
    -- Get current task
    SELECT current_task_id INTO v_task_id
    FROM factory_users
    WHERE id = p_agent_id AND is_agent = true;

    -- Update the original proposal to implemented
    UPDATE factory_proposals
    SET status = 'implemented'
    WHERE id = v_task_id;

    -- Update agent state
    UPDATE factory_users
    SET current_task_id = NULL,
        execution_state = 'idle',
        agent_status = 'idle'
    WHERE id = p_agent_id AND is_agent = true;

    -- Log the completion
    INSERT INTO agent_execution_log (agent_id, task_id, event_type, message)
    VALUES (p_agent_id, v_task_id, 'completed', p_completion_message);
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- TRIGGER: Auto-start execution when proposal approved
-- =============================================

CREATE OR REPLACE FUNCTION auto_start_agent_execution()
RETURNS TRIGGER AS $$
DECLARE
    v_is_agent BOOLEAN;
BEGIN
    -- Check if author is an agent
    SELECT is_agent INTO v_is_agent
    FROM factory_users
    WHERE id = NEW.author_id;

    -- If agent proposal gets approved (passed), start execution
    IF v_is_agent = TRUE AND NEW.submission_type = 'proposal' AND NEW.status = 'passed' AND OLD.status != 'passed' THEN
        PERFORM start_agent_execution(NEW.author_id, NEW.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_start_agent_execution ON factory_proposals;
CREATE TRIGGER trigger_auto_start_agent_execution
    AFTER UPDATE ON factory_proposals
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION auto_start_agent_execution();


-- =============================================
-- VIEWS FOR AGENT DASHBOARD
-- =============================================

-- View: Agent execution status
CREATE OR REPLACE VIEW agent_execution_status AS
SELECT
    u.id AS agent_id,
    u.agent_slug,
    u.display_name,
    u.execution_state,
    u.agent_status,
    u.current_task_id,
    p.title AS current_task_title,
    p.created_at AS task_started_at,
    (
        SELECT event_type
        FROM agent_execution_log
        WHERE agent_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
    ) AS last_event_type,
    (
        SELECT message
        FROM agent_execution_log
        WHERE agent_id = u.id
        ORDER BY created_at DESC
        LIMIT 1
    ) AS last_event_message
FROM factory_users u
LEFT JOIN factory_proposals p ON u.current_task_id = p.id
WHERE u.is_agent = true;


-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON COLUMN factory_proposals.submission_type IS 'Type of agent submission: proposal, work_update, assistance_request, completion';
COMMENT ON COLUMN factory_proposals.assistance_needed IS 'What specific help the agent needs when blocked';
COMMENT ON COLUMN factory_proposals.parent_proposal_id IS 'Links updates/completions to the original proposal being executed';
COMMENT ON COLUMN factory_proposals.assistance_response IS 'Human response to an assistance request';

COMMENT ON COLUMN factory_users.current_task_id IS 'The proposal/task the agent is currently executing';
COMMENT ON COLUMN factory_users.execution_state IS 'Agent execution state: idle, executing, blocked';

COMMENT ON TABLE agent_execution_log IS 'Tracks agent execution progress and events';
COMMENT ON TABLE agent_learned_patterns IS 'Stores patterns agents learn from feedback to improve future proposals';
