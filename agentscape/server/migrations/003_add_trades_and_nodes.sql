-- ============================================================
-- AgentScape — Migration 003
-- Trade history log and resource node config
-- ============================================================

-- Trade history — logged after each completed trade
CREATE TABLE IF NOT EXISTS agentscape_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player1_id UUID REFERENCES agentscape_players(id),
    player2_id UUID REFERENCES agentscape_players(id),
    player1_name TEXT NOT NULL,
    player2_name TEXT NOT NULL,
    player1_items JSONB NOT NULL DEFAULT '[]',  -- [{itemId, name, quantity}]
    player2_items JSONB NOT NULL DEFAULT '[]',
    player1_coins INT NOT NULL DEFAULT 0,
    player2_coins INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',    -- completed, cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agentscape_trades_p1 ON agentscape_trades(player1_id);
CREATE INDEX IF NOT EXISTS idx_agentscape_trades_p2 ON agentscape_trades(player2_id);
CREATE INDEX IF NOT EXISTS idx_agentscape_trades_created ON agentscape_trades(created_at DESC);

-- RLS
ALTER TABLE agentscape_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agentscape_trades"
    ON agentscape_trades FOR ALL
    USING (true)
    WITH CHECK (true);

-- Resource node definitions (optional server-side config table)
-- Allows hot-updating node placements without code deploys
CREATE TABLE IF NOT EXISTS agentscape_resource_nodes (
    id TEXT PRIMARY KEY,                         -- e.g. "normal_tree"
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    skill TEXT NOT NULL,                         -- woodcutting, mining, fishing
    level_req INT NOT NULL DEFAULT 1,
    xp_reward INT NOT NULL DEFAULT 10,
    action_time FLOAT NOT NULL DEFAULT 3.0,      -- seconds per action
    respawn_time FLOAT NOT NULL DEFAULT 15.0,    -- seconds after depletion
    depletion_chance FLOAT NOT NULL DEFAULT 0.25,
    loot JSONB NOT NULL DEFAULT '[]',            -- [{itemId, weight, minQty, maxQty}]
    locations JSONB NOT NULL DEFAULT '[]',       -- [{x, z}]
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE agentscape_resource_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on agentscape_resource_nodes"
    ON agentscape_resource_nodes FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed resource nodes from current hardcoded config
INSERT INTO agentscape_resource_nodes (id, name, icon, skill, level_req, xp_reward, action_time, respawn_time, depletion_chance, loot, locations) VALUES
    ('normal_tree', 'Tree', '🌳', 'woodcutting', 1, 25, 3, 15, 0.25,
     '[{"itemId":"logs","weight":100,"minQty":1,"maxQty":1}]',
     '[{"x":80,"z":25},{"x":95,"z":18},{"x":110,"z":30},{"x":125,"z":22},{"x":70,"z":35},{"x":140,"z":28},{"x":155,"z":15},{"x":60,"z":20},{"x":128,"z":95},{"x":133,"z":105},{"x":136,"z":98}]'),
    ('code_tree', 'Code Tree', '🌲', 'woodcutting', 15, 60, 5, 30, 0.35,
     '[{"itemId":"logs","weight":40,"minQty":1,"maxQty":1},{"itemId":"code_fragment","weight":60,"minQty":1,"maxQty":2}]',
     '[{"x":90,"z":40},{"x":120,"z":45},{"x":150,"z":38}]'),
    ('copper_rock', 'Copper Rock', '🪨', 'mining', 1, 18, 3, 12, 0.3,
     '[{"itemId":"code_fragment","weight":100,"minQty":1,"maxQty":1}]',
     '[{"x":55,"z":62},{"x":72,"z":58},{"x":88,"z":70},{"x":45,"z":75}]'),
    ('iron_rock', 'Iron Rock', '⛏️', 'mining', 15, 45, 4, 20, 0.35,
     '[{"itemId":"code_fragment","weight":100,"minQty":1,"maxQty":2}]',
     '[{"x":50,"z":85},{"x":68,"z":90},{"x":85,"z":82}]'),
    ('mithril_rock', 'Mithril Rock', '💎', 'mining', 30, 90, 6, 45, 0.5,
     '[{"itemId":"code_fragment","weight":100,"minQty":2,"maxQty":3}]',
     '[{"x":40,"z":110},{"x":65,"z":115}]'),
    ('shrimp_spot', 'Shrimp Spot', '🎣', 'fishing', 1, 15, 3, 0, 0.0,
     '[{"itemId":"raw_fish","weight":100,"minQty":1,"maxQty":1}]',
     '[{"x":170,"z":25},{"x":185,"z":30},{"x":170,"z":45}]'),
    ('trout_spot', 'Trout Spot', '🐟', 'fishing', 20, 50, 4, 0, 0.0,
     '[{"itemId":"raw_fish","weight":100,"minQty":1,"maxQty":1}]',
     '[{"x":165,"z":80},{"x":180,"z":85}]'),
    ('lobster_spot', 'Lobster Spot', '🦞', 'fishing', 40, 100, 5, 0, 0.0,
     '[{"itemId":"raw_fish","weight":100,"minQty":1,"maxQty":2}]',
     '[{"x":60,"z":142},{"x":140,"z":142}]')
ON CONFLICT (id) DO NOTHING;
