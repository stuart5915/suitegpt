-- Fix: Add 'client_request' to the category check constraint
-- First find and drop the existing constraint, then recreate with client_request included
DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Find the category check constraint name
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'factory_proposals'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%category%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE factory_proposals DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Recreate with client_request included (plus all existing values)
ALTER TABLE factory_proposals ADD CONSTRAINT factory_proposals_category_check
    CHECK (category IN ('feature', 'improvement', 'bug', 'app_idea', 'tokenomics', 'content', 'marketing', 'social', 'integration', 'client_request'));

-- Fix: Also update status constraint to include all needed values
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'factory_proposals'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%status%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE factory_proposals DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

ALTER TABLE factory_proposals ADD CONSTRAINT factory_proposals_status_check
    CHECK (status IN ('draft', 'open', 'submitted', 'approved', 'rejected', 'implemented', 'working_on', 'open_voting', 'passed', 'processing', 'completed', 'failed'));

-- Fix RLS: Drop old policies if they exist, recreate properly
-- These need to work for anon (unauthenticated) users
DROP POLICY IF EXISTS "Allow anon insert client requests" ON factory_proposals;
DROP POLICY IF EXISTS "Allow anon read client requests" ON factory_proposals;
DROP POLICY IF EXISTS "Allow anon update client requests" ON factory_proposals;

-- Ensure RLS is enabled
ALTER TABLE factory_proposals ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert client requests (no auth required)
CREATE POLICY "anon_insert_client_requests"
    ON factory_proposals
    FOR INSERT
    TO anon
    WITH CHECK (category = 'client_request');

-- Allow anyone to read client requests
CREATE POLICY "anon_select_client_requests"
    ON factory_proposals
    FOR SELECT
    TO anon
    USING (category = 'client_request');

-- Allow daemon (anon) to update client request status
CREATE POLICY "anon_update_client_requests"
    ON factory_proposals
    FOR UPDATE
    TO anon
    USING (category = 'client_request')
    WITH CHECK (category = 'client_request');
