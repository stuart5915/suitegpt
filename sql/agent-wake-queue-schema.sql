-- Agent Wake Request Queue
-- Allows the dashboard to queue wake requests that a local daemon executes

-- Create the wake requests table
CREATE TABLE IF NOT EXISTS agent_wake_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_slug TEXT NOT NULL,
    requested_by UUID REFERENCES factory_users(id),
    requested_at TIMESTAMPTZ DEFAULT NOW(),

    -- Status: pending, processing, completed, failed
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- Execution tracking
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Result
    result_proposal_id UUID REFERENCES factory_proposals(id),
    error_message TEXT,

    -- Metadata
    notes TEXT
);

-- Index for efficient polling
CREATE INDEX IF NOT EXISTS idx_wake_requests_pending
    ON agent_wake_requests(status, requested_at)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_wake_requests_agent
    ON agent_wake_requests(agent_slug, requested_at DESC);

-- RLS Policies
ALTER TABLE agent_wake_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can read wake requests (transparency)
CREATE POLICY "Wake requests are viewable by everyone"
    ON agent_wake_requests FOR SELECT
    USING (true);

-- Only authenticated users can create wake requests
CREATE POLICY "Authenticated users can create wake requests"
    ON agent_wake_requests FOR INSERT
    WITH CHECK (true);

-- Only service role can update (daemon uses service key)
CREATE POLICY "Service role can update wake requests"
    ON agent_wake_requests FOR UPDATE
    USING (true);

-- Function to claim a pending wake request (prevents race conditions)
CREATE OR REPLACE FUNCTION claim_wake_request(p_agent_slug TEXT DEFAULT NULL)
RETURNS TABLE (
    request_id UUID,
    agent_slug TEXT,
    requested_at TIMESTAMPTZ
) AS $$
DECLARE
    v_request_id UUID;
    v_agent_slug TEXT;
    v_requested_at TIMESTAMPTZ;
BEGIN
    -- Lock and claim the oldest pending request
    UPDATE agent_wake_requests
    SET status = 'processing',
        started_at = NOW()
    WHERE id = (
        SELECT id FROM agent_wake_requests
        WHERE status = 'pending'
        AND (p_agent_slug IS NULL OR agent_wake_requests.agent_slug = p_agent_slug)
        ORDER BY requested_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING id, agent_wake_requests.agent_slug, agent_wake_requests.requested_at
    INTO v_request_id, v_agent_slug, v_requested_at;

    IF v_request_id IS NOT NULL THEN
        RETURN QUERY SELECT v_request_id, v_agent_slug, v_requested_at;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a wake request
CREATE OR REPLACE FUNCTION complete_wake_request(
    p_request_id UUID,
    p_proposal_id UUID DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE agent_wake_requests
    SET status = CASE WHEN p_error_message IS NULL THEN 'completed' ELSE 'failed' END,
        completed_at = NOW(),
        result_proposal_id = p_proposal_id,
        error_message = p_error_message
    WHERE id = p_request_id;
END;
$$ LANGUAGE plpgsql;

-- View for pending requests (useful for dashboard)
CREATE OR REPLACE VIEW pending_wake_requests AS
SELECT
    wr.id,
    wr.agent_slug,
    wr.requested_at,
    wr.status,
    fu.display_name as requested_by_name
FROM agent_wake_requests wr
LEFT JOIN factory_users fu ON wr.requested_by = fu.id
WHERE wr.status IN ('pending', 'processing')
ORDER BY wr.requested_at ASC;

COMMENT ON TABLE agent_wake_requests IS 'Queue for agent wake requests. Dashboard inserts, local daemon processes.';

-- Daemon heartbeat table (for online status)
CREATE TABLE IF NOT EXISTS daemon_heartbeat (
    id TEXT PRIMARY KEY DEFAULT 'wake-daemon',
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    hostname TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for heartbeat
ALTER TABLE daemon_heartbeat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Heartbeat readable by everyone"
    ON daemon_heartbeat FOR SELECT
    USING (true);

CREATE POLICY "Heartbeat writable by service role"
    ON daemon_heartbeat FOR ALL
    USING (true);

-- Upsert heartbeat function
CREATE OR REPLACE FUNCTION update_daemon_heartbeat(p_hostname TEXT DEFAULT 'unknown')
RETURNS VOID AS $$
BEGIN
    INSERT INTO daemon_heartbeat (id, last_heartbeat, hostname, started_at)
    VALUES ('wake-daemon', NOW(), p_hostname, NOW())
    ON CONFLICT (id) DO UPDATE
    SET last_heartbeat = NOW(),
        hostname = p_hostname;
END;
$$ LANGUAGE plpgsql;
