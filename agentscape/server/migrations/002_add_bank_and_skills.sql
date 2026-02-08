-- ============================================================
-- AgentScape — Migration 002
-- Adds bank storage table and skilling columns
-- ============================================================

-- Player bank (persistent item storage separate from inventory)
CREATE TABLE IF NOT EXISTS agentscape_bank (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES agentscape_players(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL DEFAULT '',
    item_icon TEXT NOT NULL DEFAULT '',
    item_type TEXT NOT NULL DEFAULT 'misc',
    quantity INT NOT NULL DEFAULT 1,
    attack_stat INT NOT NULL DEFAULT 0,
    strength_stat INT NOT NULL DEFAULT 0,
    defence_stat INT NOT NULL DEFAULT 0,
    heal_amount INT NOT NULL DEFAULT 0,
    slot_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(player_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_agentscape_bank_player ON agentscape_bank(player_id);

-- New skilling columns on agentscape_players
ALTER TABLE agentscape_players
    ADD COLUMN IF NOT EXISTS woodcutting INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS woodcutting_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS mining INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS mining_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fishing INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS fishing_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cooking INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS cooking_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS smithing INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS smithing_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS crafting INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS crafting_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS fletching INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS fletching_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS runecrafting INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS runecrafting_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prayer INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS prayer_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS thieving INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS thieving_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_level INT NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bank_capacity INT NOT NULL DEFAULT 200;

-- Update leaderboard view to include total level and total XP across all skills
CREATE OR REPLACE VIEW agentscape_leaderboard AS
SELECT
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
ORDER BY combat_level DESC, (attack_xp + strength_xp + defence_xp + hitpoints_xp) DESC
LIMIT 100;

-- RLS for bank table
ALTER TABLE agentscape_bank ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agentscape_bank"
    ON agentscape_bank FOR ALL
    USING (true)
    WITH CHECK (true);
