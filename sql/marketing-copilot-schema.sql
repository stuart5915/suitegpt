-- Marketing Co-Pilot Schema
-- Run this in Supabase SQL Editor

-- Brand Voice settings
CREATE TABLE IF NOT EXISTS brand_voice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tone TEXT DEFAULT 'casual, authentic, builder-focused',
    use_words TEXT[] DEFAULT ARRAY['shipping', 'building', 'ecosystem', 'SUITE', 'yield'],
    avoid_words TEXT[] DEFAULT ARRAY['revolutionary', 'game-changing', 'synergy', 'disrupt'],
    style_notes TEXT DEFAULT 'Short punchy sentences. Minimal emojis. No hard sells. End with insight.',
    example_posts TEXT[] DEFAULT ARRAY[]::TEXT[],
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current marketing state (single row, updated daily)
CREATE TABLE IF NOT EXISTS marketing_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE,
    priorities TEXT[] DEFAULT ARRAY[]::TEXT[],
    recent_context JSONB DEFAULT '{"shipped": [], "metrics": {}, "notes": []}'::jsonb,
    todays_schedule JSONB DEFAULT '[]'::jsonb,
    pending_inputs JSONB DEFAULT '[]'::jsonb,
    github_activity JSONB DEFAULT '[]'::jsonb,
    raw_content TEXT, -- The full state file as text for AI context
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- State history (archived daily states for AI memory)
CREATE TABLE IF NOT EXISTS marketing_state_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    state_content TEXT NOT NULL, -- Full state file content
    priorities TEXT[],
    posts_published INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All marketing posts (history + scheduled)
CREATE TABLE IF NOT EXISTS marketing_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    time TIME NOT NULL,
    cadence TEXT NOT NULL, -- 'x-posts', 'linkedin-posts', etc.
    platform TEXT NOT NULL, -- 'x', 'linkedin'
    content TEXT,
    image_url TEXT,
    status TEXT DEFAULT 'draft', -- 'draft', 'approved', 'posted', 'skipped'
    themes TEXT[] DEFAULT ARRAY[]::TEXT[], -- For avoiding repetition
    external_id TEXT, -- Tweet ID, LinkedIn post ID after posting
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing chat history
CREATE TABLE IF NOT EXISTS marketing_chat (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE DEFAULT CURRENT_DATE,
    role TEXT NOT NULL, -- 'assistant' or 'user'
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- For inline actions, post refs, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_marketing_posts_date ON marketing_posts(date);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON marketing_posts(status);
CREATE INDEX IF NOT EXISTS idx_marketing_state_history_date ON marketing_state_history(date);
CREATE INDEX IF NOT EXISTS idx_marketing_chat_date ON marketing_chat(date);

-- Insert default brand voice if not exists
INSERT INTO brand_voice (id, tone, use_words, avoid_words, style_notes)
SELECT
    '00000000-0000-0000-0000-000000000001',
    'casual, authentic, builder-focused',
    ARRAY['shipping', 'building', 'ecosystem', 'SUITE', 'yield', 'apps'],
    ARRAY['revolutionary', 'game-changing', 'synergy', 'disrupt', 'leverage'],
    'Short punchy sentences. Minimal emojis. Building in public vibes. No hard sells.'
WHERE NOT EXISTS (SELECT 1 FROM brand_voice LIMIT 1);

-- RLS Policies (public read for now, can restrict later)
ALTER TABLE brand_voice ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_chat ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for now (you can restrict later)
CREATE POLICY "Allow all on brand_voice" ON brand_voice FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_state" ON marketing_state FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_state_history" ON marketing_state_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_posts" ON marketing_posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on marketing_chat" ON marketing_chat FOR ALL USING (true) WITH CHECK (true);
