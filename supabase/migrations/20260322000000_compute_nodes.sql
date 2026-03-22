-- Inclawbate Compute Network — Node tracking table
-- Stores registered GPU nodes, their specs, uptime, and earned compute units.

CREATE TABLE IF NOT EXISTS compute_nodes (
    wallet          TEXT PRIMARY KEY,
    gpu_name        TEXT NOT NULL,
    gpu_vram_gb     INTEGER DEFAULT 0,
    os              TEXT DEFAULT 'unknown',
    node_version    TEXT DEFAULT '0.1.0',
    status          TEXT DEFAULT 'offline',        -- online, offline, paused
    last_heartbeat  TIMESTAMPTZ,
    registered_at   TIMESTAMPTZ DEFAULT NOW(),
    gpu_utilization REAL DEFAULT 0,                -- 0-100%
    jobs_completed  INTEGER DEFAULT 0,
    current_task    TEXT,                           -- what the node is currently doing
    compute_units   BIGINT DEFAULT 0,              -- lifetime compute units earned
    unclaimed_units BIGINT DEFAULT 0,              -- units not yet claimed as CLAWS
    claim_nonce     INTEGER DEFAULT 0,             -- matches on-chain claimNonce
    last_claim      TIMESTAMPTZ
);

-- Index for finding online nodes quickly
CREATE INDEX IF NOT EXISTS idx_compute_nodes_status ON compute_nodes(status);
CREATE INDEX IF NOT EXISTS idx_compute_nodes_heartbeat ON compute_nodes(last_heartbeat);

-- Enable RLS
ALTER TABLE compute_nodes ENABLE ROW LEVEL SECURITY;

-- Public can read node status (for the network dashboard)
CREATE POLICY "compute_nodes_public_read" ON compute_nodes
    FOR SELECT USING (true);

-- Only service role can insert/update (API endpoints use service role key)
CREATE POLICY "compute_nodes_service_write" ON compute_nodes
    FOR ALL USING (true) WITH CHECK (true);
