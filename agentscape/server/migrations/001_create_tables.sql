-- ============================================================
-- AgentScape — Supabase Migration
-- New tables for player persistence and economy audit
-- Uses the SAME Supabase instance as suitegpt.app
-- ============================================================

-- Player saves
CREATE TABLE IF NOT EXISTS agentscape_players (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    supabase_user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL DEFAULT 'Player',
    color TEXT NOT NULL DEFAULT '#3355aa',
    tile_x INT NOT NULL DEFAULT 15,
    tile_z INT NOT NULL DEFAULT 15,
    hp INT NOT NULL DEFAULT 100,
    max_hp INT NOT NULL DEFAULT 100,
    energy INT NOT NULL DEFAULT 100,
    attack INT NOT NULL DEFAULT 1,
    strength INT NOT NULL DEFAULT 1,
    defence INT NOT NULL DEFAULT 1,
    hitpoints INT NOT NULL DEFAULT 10,
    attack_xp INT NOT NULL DEFAULT 0,
    strength_xp INT NOT NULL DEFAULT 0,
    defence_xp INT NOT NULL DEFAULT 0,
    hitpoints_xp INT NOT NULL DEFAULT 0,
    combat_level INT NOT NULL DEFAULT 3,
    equipped_weapon_slot INT NOT NULL DEFAULT -1,
    equipped_helm_slot INT NOT NULL DEFAULT -1,
    equipped_shield_slot INT NOT NULL DEFAULT -1,
    inventory JSONB NOT NULL DEFAULT '[]'::jsonb,
    quests JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_kills INT NOT NULL DEFAULT 0,
    total_deaths INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Economy audit log
CREATE TABLE IF NOT EXISTS agentscape_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'buy', 'sell', 'loot', 'quest_reward', 'craft', 'death_loss'
    item_id TEXT,
    quantity INT,
    coins_delta INT,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard view
CREATE OR REPLACE VIEW agentscape_leaderboard AS
SELECT
    name,
    combat_level,
    attack_xp + strength_xp + defence_xp + hitpoints_xp AS total_xp,
    total_kills,
    total_deaths,
    attack,
    strength,
    defence,
    hitpoints,
    updated_at
FROM agentscape_players
ORDER BY combat_level DESC, (attack_xp + strength_xp + defence_xp + hitpoints_xp) DESC
LIMIT 100;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agentscape_players_session ON agentscape_players(session_id);
CREATE INDEX IF NOT EXISTS idx_agentscape_players_user ON agentscape_players(supabase_user_id);
CREATE INDEX IF NOT EXISTS idx_agentscape_transactions_player ON agentscape_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_agentscape_transactions_type ON agentscape_transactions(event_type);

-- RLS policies (allow server service role full access)
ALTER TABLE agentscape_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentscape_transactions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on agentscape_players"
    ON agentscape_players FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on agentscape_transactions"
    ON agentscape_transactions FOR ALL
    USING (true)
    WITH CHECK (true);
