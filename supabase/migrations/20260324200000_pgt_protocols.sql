-- Protocols / Companies directory
CREATE TABLE IF NOT EXISTS pgt_protocols (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    website TEXT,
    x_handle TEXT,
    github TEXT,
    category TEXT DEFAULT 'protocol',  -- chain, defi, ai-company, infra, exchange, wallet
    chain TEXT,
    logo_url TEXT,
    token_symbol TEXT,
    notes TEXT,
    submitted_by TEXT,
    approved BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    mentions_count INTEGER DEFAULT 0,
    last_mentioned TIMESTAMPTZ,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgt_protocols_category ON pgt_protocols(category);
ALTER TABLE pgt_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pgt_protocols_read" ON pgt_protocols FOR SELECT USING (true);
CREATE POLICY "pgt_protocols_write" ON pgt_protocols FOR ALL USING (true) WITH CHECK (true);
