-- ============================================================
-- AgentScape — Migration 004
-- Achievements, activity feed, chat log, expanded equipment
-- ============================================================

-- Achievement definitions
CREATE TABLE IF NOT EXISTS agentscape_achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'general',
    requirement_type TEXT NOT NULL,
    requirement_param TEXT NOT NULL DEFAULT '',
    threshold INT NOT NULL DEFAULT 1,
    points INT NOT NULL DEFAULT 10,
    tier TEXT NOT NULL DEFAULT 'bronze',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Player achievement progress
CREATE TABLE IF NOT EXISTS agentscape_player_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES agentscape_players(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL REFERENCES agentscape_achievements(id),
    progress INT NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    UNIQUE(player_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_agentscape_pa_player ON agentscape_player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_agentscape_pa_completed ON agentscape_player_achievements(completed) WHERE completed = true;

-- Activity feed (server-wide events: achievements, rare drops, milestones)
CREATE TABLE IF NOT EXISTS agentscape_activity (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,     -- achievement, rare_drop, level_milestone, boss_kill, first_kill
    player_name TEXT NOT NULL,
    message TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentscape_activity_created ON agentscape_activity(created_at DESC);

-- Chat log (for moderation + persistence)
CREATE TABLE IF NOT EXISTS agentscape_chat_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_session_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    message TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'global',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentscape_chat_created ON agentscape_chat_log(created_at DESC);

-- Expanded equipment columns on agentscape_players
ALTER TABLE agentscape_players
    ADD COLUMN IF NOT EXISTS equipped_body_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS equipped_legs_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS equipped_boots_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS equipped_gloves_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS equipped_cape_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS equipped_ring_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS equipped_amulet_slot INT NOT NULL DEFAULT -1,
    ADD COLUMN IF NOT EXISTS achievement_points INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS achievements_completed INT NOT NULL DEFAULT 0;

-- RLS
ALTER TABLE agentscape_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentscape_player_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentscape_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE agentscape_chat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agentscape_achievements"
    ON agentscape_achievements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on agentscape_player_achievements"
    ON agentscape_player_achievements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on agentscape_activity"
    ON agentscape_activity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on agentscape_chat_log"
    ON agentscape_chat_log FOR ALL USING (true) WITH CHECK (true);

-- Seed achievements
INSERT INTO agentscape_achievements (id, name, description, icon, category, requirement_type, requirement_param, threshold, points, tier) VALUES
    ('first_blood', 'First Blood', 'Defeat your first monster', '🗡️', 'combat', 'kill_count', '', 1, 5, 'bronze'),
    ('monster_slayer', 'Monster Slayer', 'Defeat 50 monsters', '⚔️', 'combat', 'kill_count', '', 50, 15, 'silver'),
    ('centurion', 'Centurion', 'Defeat 100 monsters', '🛡️', 'combat', 'kill_count', '', 100, 25, 'gold'),
    ('warlord', 'Warlord', 'Defeat 500 monsters', '👑', 'combat', 'kill_count', '', 500, 50, 'master'),
    ('combat_10', 'Apprentice Fighter', 'Reach combat level 10', '🥊', 'combat', 'combat_level', '', 10, 10, 'bronze'),
    ('combat_30', 'Seasoned Warrior', 'Reach combat level 30', '⚔️', 'combat', 'combat_level', '', 30, 25, 'silver'),
    ('combat_60', 'Elite Combatant', 'Reach combat level 60', '🏆', 'combat', 'combat_level', '', 60, 50, 'gold'),
    ('combat_99', 'Maxed Fighter', 'Reach combat level 99', '💎', 'combat', 'combat_level', '', 99, 100, 'legendary'),
    ('woodcutting_10', 'Lumberjack', 'Reach Woodcutting level 10', '🪓', 'skilling', 'skill_level', 'woodcutting', 10, 10, 'bronze'),
    ('mining_10', 'Prospector', 'Reach Mining level 10', '⛏️', 'skilling', 'skill_level', 'mining', 10, 10, 'bronze'),
    ('fishing_10', 'Angler', 'Reach Fishing level 10', '🎣', 'skilling', 'skill_level', 'fishing', 10, 10, 'bronze'),
    ('cooking_10', 'Chef', 'Reach Cooking level 10', '🍳', 'skilling', 'skill_level', 'cooking', 10, 10, 'bronze'),
    ('smithing_10', 'Blacksmith', 'Reach Smithing level 10', '🔨', 'skilling', 'skill_level', 'smithing', 10, 10, 'bronze'),
    ('any_skill_50', 'Dedicated', 'Reach level 50 in any skill', '🌟', 'skilling', 'skill_level', '*', 50, 35, 'gold'),
    ('any_skill_99', 'Master Skiller', 'Reach level 99 in any skill', '💫', 'skilling', 'skill_level', '*', 99, 100, 'legendary'),
    ('total_100', 'Well-Rounded', 'Reach total level 100', '📊', 'skilling', 'total_level', '', 100, 20, 'silver'),
    ('total_500', 'Jack of All Trades', 'Reach total level 500', '📈', 'skilling', 'total_level', '', 500, 50, 'gold'),
    ('total_1000', 'Legendary', 'Reach total level 1000', '🏅', 'skilling', 'total_level', '', 1000, 100, 'legendary'),
    ('boss_rogue_script', 'Debugger', 'Defeat the Rogue Script', '🐛', 'boss', 'boss_kill', 'rogue_script', 1, 30, 'silver'),
    ('boss_404_golem', 'Error Handler', 'Defeat the 404 Golem', '🪨', 'boss', 'boss_kill', '404_golem', 1, 40, 'gold'),
    ('boss_hallucinator', 'Truth Seeker', 'Defeat the Hallucinator', '🌀', 'boss', 'boss_kill', 'hallucinator', 1, 50, 'gold'),
    ('boss_dragon', 'Dragon Slayer', 'Defeat the Data Breach Dragon', '🐉', 'boss', 'boss_kill', 'data_breach_dragon', 1, 100, 'legendary'),
    ('coins_1k', 'Getting Started', 'Earn 1,000 coins', '🪙', 'economy', 'coins_earned', '', 1000, 10, 'bronze'),
    ('coins_100k', 'Wealthy', 'Earn 100,000 coins', '💰', 'economy', 'coins_earned', '', 100000, 35, 'gold'),
    ('coins_1m', 'Millionaire', 'Earn 1,000,000 coins', '🤑', 'economy', 'coins_earned', '', 1000000, 75, 'master'),
    ('first_trade', 'Trader', 'Complete your first trade', '🤝', 'economy', 'trade_count', '', 1, 10, 'bronze'),
    ('visit_forest', 'Into the Wild', 'Enter The Forest zone', '🌲', 'exploration', 'zone_visit', 'forest', 1, 5, 'bronze'),
    ('visit_ruins', 'Ruin Explorer', 'Enter The Ruins zone', '🏛️', 'exploration', 'zone_visit', 'ruins', 1, 10, 'bronze'),
    ('visit_deep', 'Deep Diver', 'Enter The Deep Network', '🌀', 'exploration', 'zone_visit', 'deep_network', 1, 15, 'silver'),
    ('first_death', 'Learning Experience', 'Die for the first time', '💀', 'social', 'deaths', '', 1, 5, 'bronze'),
    ('die_50', 'Persistent', 'Die 50 times', '☠️', 'social', 'deaths', '', 50, 20, 'silver')
ON CONFLICT (id) DO NOTHING;

-- Clean up old activity entries (keep last 500)
-- Run periodically: DELETE FROM agentscape_activity WHERE id NOT IN (SELECT id FROM agentscape_activity ORDER BY created_at DESC LIMIT 500);
