-- MemeClaw voting table
-- Each row = one vote on a meme token's community idea

CREATE TABLE IF NOT EXISTS memeclaw_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT NOT NULL,
    option INTEGER NOT NULL CHECK (option BETWEEN 1 AND 4),
    voter_ip TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memeclaw_votes_slug ON memeclaw_votes(slug);
