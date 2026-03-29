-- User Agents — AI agent configuration system
-- Each user can create multiple agents, each with capabilities and connections

-- ── The Agent ──
CREATE TABLE IF NOT EXISTS user_agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_wallet TEXT NOT NULL,
    name TEXT NOT NULL,
    persona TEXT,                          -- personality/vibe description
    avatar_url TEXT,
    status TEXT NOT NULL DEFAULT 'paused', -- active, paused, setup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_agents_wallet ON user_agents(owner_wallet);

-- ── Connections — linked accounts and keys ──
CREATE TABLE IF NOT EXISTS agent_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                    -- x_account, telegram_bot, wallet, webhook, api_key, token, watch_wallet
    label TEXT,                            -- human-readable label (e.g. "@mybot", "CLAWS", "whale wallet")
    value TEXT NOT NULL,                   -- the actual value (token, address, URL, key)
    metadata JSONB DEFAULT '{}',          -- extra config (e.g. X OAuth tokens, refresh tokens)
    connected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_connections_agent ON agent_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_connections_type ON agent_connections(type);

-- ── Capabilities — what the agent can do ──
CREATE TABLE IF NOT EXISTS agent_capabilities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL,                    -- x_posting, x_replies, dca_buy, analytics, whale_watch, token_track, custom
    enabled BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',            -- capability-specific settings
    -- x_posting: { frequency: 3, vibe: "professional", topics: ["defi","crypto"] }
    -- dca_buy: { token: "0x...", amount: "0.01", currency: "ETH", frequency: "daily" }
    -- analytics: { token: "0x...", destination: "x"|"telegram", frequency: "daily" }
    -- whale_watch: { wallet: "0x...", threshold_usd: 1000 }
    -- token_track: { token: "0x...", alert_pct: 10 }
    -- x_replies: { persona: "friendly", max_per_day: 10 }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent ON agent_capabilities(agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_cap_unique ON agent_capabilities(agent_id, type);

-- ── Activity Log — what the agent has done ──
CREATE TABLE IF NOT EXISTS agent_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    capability_type TEXT NOT NULL,         -- which capability triggered this
    action TEXT NOT NULL,                  -- posted_tweet, sent_alert, executed_buy, etc.
    details JSONB DEFAULT '{}',           -- action-specific data (tweet text, tx hash, alert message)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_time ON agent_activity_log(created_at DESC);
