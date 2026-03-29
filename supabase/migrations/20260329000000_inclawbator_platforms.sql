-- Inclawbator Platform Tracker — track all platforms the agent is listed on
CREATE TABLE IF NOT EXISTS inclawbator_platforms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,              -- short: what is this platform
    website TEXT,                  -- link to the platform
    listing_url TEXT,              -- link to our specific agent listing
    x_handle TEXT,                 -- platform's X handle
    category TEXT DEFAULT 'ai-agent',  -- ai-agent, defi, social, depin, marketplace, launchpad, other
    status TEXT DEFAULT 'discovered',  -- discovered, applied, live, announced, rejected, paused
    logo_url TEXT,
    notes TEXT,
    submitted_by TEXT,
    approved BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    mentions_count INTEGER DEFAULT 0,
    last_mentioned TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inclawbator_platforms_status ON inclawbator_platforms(status);
CREATE INDEX IF NOT EXISTS idx_inclawbator_platforms_category ON inclawbator_platforms(category);
ALTER TABLE inclawbator_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inclawbator_platforms_read" ON inclawbator_platforms FOR SELECT USING (true);
CREATE POLICY "inclawbator_platforms_write" ON inclawbator_platforms FOR ALL USING (true) WITH CHECK (true);
