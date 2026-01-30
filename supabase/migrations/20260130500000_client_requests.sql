-- Client Request System: extend factory_proposals for client change requests
-- Adds columns for client app tracking, Claude CLI integration, and processing status

-- Add client request columns to factory_proposals
ALTER TABLE factory_proposals
    ADD COLUMN IF NOT EXISTS client_app text,
    ADD COLUMN IF NOT EXISTS client_project_dir text,
    ADD COLUMN IF NOT EXISTS claude_prompt text,
    ADD COLUMN IF NOT EXISTS claude_output text,
    ADD COLUMN IF NOT EXISTS error_message text,
    ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Drop the existing status constraint if it exists, then re-create with new values
DO $$
BEGIN
    ALTER TABLE factory_proposals DROP CONSTRAINT IF EXISTS factory_proposals_status_check;
    ALTER TABLE factory_proposals ADD CONSTRAINT factory_proposals_status_check
        CHECK (status IN ('draft', 'open', 'approved', 'rejected', 'implemented', 'processing', 'completed', 'failed'));
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Index for daemon polling: find approved client requests efficiently
CREATE INDEX IF NOT EXISTS idx_factory_proposals_client_requests
    ON factory_proposals (status, category)
    WHERE category = 'client_request';

-- RLS: allow anon to insert client requests (from admin dashboards)
CREATE POLICY IF NOT EXISTS "Allow anon insert client requests"
    ON factory_proposals
    FOR INSERT
    TO anon
    WITH CHECK (category = 'client_request');

-- RLS: allow anon to read client requests for their app
CREATE POLICY IF NOT EXISTS "Allow anon read client requests"
    ON factory_proposals
    FOR SELECT
    TO anon
    USING (category = 'client_request');

-- RLS: allow anon to update status on client requests (for daemon)
CREATE POLICY IF NOT EXISTS "Allow anon update client requests"
    ON factory_proposals
    FOR UPDATE
    TO anon
    USING (category = 'client_request');
