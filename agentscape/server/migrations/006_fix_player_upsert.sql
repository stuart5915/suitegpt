-- ============================================================
-- AgentScape — Migration 006
-- Fix: authenticated players were creating duplicate rows because
-- upsert targeted session_id (changes every connection) instead
-- of supabase_user_id (stable per account).
--
-- 1. Clean up duplicates (keep most recent per user)
-- 2. Add unique constraint on supabase_user_id
-- 3. Drop session_id unique constraint (no longer meaningful)
-- ============================================================

-- Step 1: Delete all but the newest row per supabase_user_id
DELETE FROM agentscape_players a
USING agentscape_players b
WHERE a.supabase_user_id IS NOT NULL
  AND a.supabase_user_id = b.supabase_user_id
  AND a.id <> b.id
  AND a.updated_at < b.updated_at;

-- Step 2: Add unique constraint on supabase_user_id (for authenticated players)
-- NULL values are ignored by unique constraints, so guests are unaffected
ALTER TABLE agentscape_players
    DROP CONSTRAINT IF EXISTS agentscape_players_session_id_key;

ALTER TABLE agentscape_players
    ALTER COLUMN session_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agentscape_players_user_unique
    ON agentscape_players (supabase_user_id)
    WHERE supabase_user_id IS NOT NULL;
