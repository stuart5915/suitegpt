-- Sermons table for S4H sermon writer (team-gated)
CREATE TABLE IF NOT EXISTS sermons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'Untitled Sermon',
    content_html TEXT DEFAULT '',
    font_family TEXT DEFAULT 'Caveat',
    font_size TEXT DEFAULT '18px',
    line_spacing TEXT DEFAULT '29px',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sermons_wallet ON sermons(wallet_address);
