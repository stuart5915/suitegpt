-- ============================================================
-- AgentScape — Migration 006 (DDL only, data cleanup done via API)
-- Fix: add unique index on supabase_user_id so authenticated
-- players upsert correctly instead of creating duplicate rows.
-- ============================================================

-- Drop old session_id unique constraint (session changes every connection)
ALTER TABLE agentscape_players
    DROP CONSTRAINT IF EXISTS agentscape_players_session_id_key;

-- Allow null session_id (it's no longer the primary identifier)
ALTER TABLE agentscape_players
    ALTER COLUMN session_id DROP NOT NULL;

-- Add unique partial index for authenticated players
-- NULL values are ignored, so guests are unaffected
CREATE UNIQUE INDEX IF NOT EXISTS idx_agentscape_players_user_unique
    ON agentscape_players (supabase_user_id)
    WHERE supabase_user_id IS NOT NULL;
