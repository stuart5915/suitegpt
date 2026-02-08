-- ============================================================
-- AgentScape — Migration 005
-- Fix duplicate players on leaderboard by deduplicating view
-- Keep only the highest-progress row per player name
-- Also clean up stale duplicate rows
-- ============================================================

-- Replace leaderboard view with deduplicated version
-- Uses DISTINCT ON to keep only the best row per player name
CREATE OR REPLACE VIEW agentscape_leaderboard AS
SELECT DISTINCT ON (name)
    name,
    combat_level,
    attack_xp + strength_xp + defence_xp + hitpoints_xp AS total_xp,
    total_kills AS kills,
    total_deaths AS deaths,
    attack,
    strength,
    defence,
    hitpoints,
    woodcutting,
    mining,
    fishing,
    cooking,
    total_level,
    updated_at
FROM agentscape_players
ORDER BY name, combat_level DESC, (attack_xp + strength_xp + defence_xp + hitpoints_xp) DESC, updated_at DESC;

-- Delete duplicate player rows, keeping only the most recent per supabase_user_id
-- (for authenticated players)
DELETE FROM agentscape_players a
USING agentscape_players b
WHERE a.supabase_user_id IS NOT NULL
  AND a.supabase_user_id = b.supabase_user_id
  AND a.id <> b.id
  AND a.updated_at < b.updated_at;

-- For guest players (no supabase_user_id), deduplicate by name
-- keeping the one with the most progress
DELETE FROM agentscape_players a
USING agentscape_players b
WHERE a.supabase_user_id IS NULL
  AND b.supabase_user_id IS NULL
  AND a.name = b.name
  AND a.id <> b.id
  AND (a.attack_xp + a.strength_xp + a.defence_xp + a.hitpoints_xp)
    < (b.attack_xp + b.strength_xp + b.defence_xp + b.hitpoints_xp);
