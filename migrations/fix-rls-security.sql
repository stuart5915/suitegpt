-- =============================================
-- SECURITY FIX: Remove Permissive Write Policies
-- =============================================
--
-- PROBLEM: Previous "Service write" policies used USING(true) WITH CHECK(true)
-- which allowed ANYONE (including anon key users) to write to tables.
--
-- FIX: Remove these policies. Edge functions use service_role which bypasses
-- RLS entirely, so they'll continue working. But anonymous users can no longer
-- write directly to the database.
--
-- Date: 2026-01-21
-- =============================================

-- Factory tables (these should exist)
DROP POLICY IF EXISTS "Service write factory_users" ON factory_users;
DROP POLICY IF EXISTS "Service write factory_proposals" ON factory_proposals;
DROP POLICY IF EXISTS "Service write factory_votes" ON factory_votes;
DROP POLICY IF EXISTS "Service write factory_rep_history" ON factory_rep_history;
DROP POLICY IF EXISTS "Service write factory_comments" ON factory_comments;

-- =============================================
-- VERIFY: Public read policies should still exist
-- =============================================
-- These are intentional - governance data should be readable by everyone
-- If they were accidentally dropped, recreate them:

-- Factory Users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'factory_users' AND policyname = 'Public read factory_users'
    ) THEN
        CREATE POLICY "Public read factory_users" ON factory_users FOR SELECT USING (true);
    END IF;
END $$;

-- Factory Proposals
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'factory_proposals' AND policyname = 'Public read factory_proposals'
    ) THEN
        CREATE POLICY "Public read factory_proposals" ON factory_proposals FOR SELECT USING (true);
    END IF;
END $$;

-- Factory Votes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'factory_votes' AND policyname = 'Public read factory_votes'
    ) THEN
        CREATE POLICY "Public read factory_votes" ON factory_votes FOR SELECT USING (true);
    END IF;
END $$;

-- Factory Rep History
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'factory_rep_history' AND policyname = 'Public read factory_rep_history'
    ) THEN
        CREATE POLICY "Public read factory_rep_history" ON factory_rep_history FOR SELECT USING (true);
    END IF;
END $$;

-- Factory Comments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'factory_comments' AND policyname = 'Public read factory_comments'
    ) THEN
        CREATE POLICY "Public read factory_comments" ON factory_comments FOR SELECT USING (true);
    END IF;
END $$;

-- =============================================
-- RESULT:
-- - Anonymous users can READ all governance data (transparency)
-- - Anonymous users CANNOT write to any tables
-- - Edge functions (with service_role) CAN write to all tables
-- =============================================
