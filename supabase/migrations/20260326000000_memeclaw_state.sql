-- MemeClaw — persistent meme tracking and launch state
CREATE TABLE IF NOT EXISTS memeclaw_memes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    meme_name TEXT NOT NULL,
    meme_link TEXT,
    symbol TEXT,
    description TEXT,
    image_url TEXT,
    kym_guid TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'queued',  -- queued, launching, launched, failed
    token_address TEXT,
    site_url TEXT,
    site_slug TEXT,
    launch_tx TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    launched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memeclaw_status ON memeclaw_memes(status);
CREATE INDEX IF NOT EXISTS idx_memeclaw_guid ON memeclaw_memes(kym_guid);
