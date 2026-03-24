-- Curated news feed for publicgoods.tech
CREATE TABLE IF NOT EXISTS pgt_news (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    source TEXT,              -- "CoinDesk", "TheBlock", "X/@handle"
    source_handle TEXT,       -- X handle of source
    category TEXT DEFAULT 'news',  -- news, launch, funding, tutorial, opinion
    tags TEXT[],
    submitted_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgt_news_created ON pgt_news(created_at DESC);
ALTER TABLE pgt_news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pgt_news_read" ON pgt_news FOR SELECT USING (true);
CREATE POLICY "pgt_news_write" ON pgt_news FOR ALL USING (true) WITH CHECK (true);
