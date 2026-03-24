-- publicgoods.tech platform tables

-- AI Agent directory
CREATE TABLE IF NOT EXISTS pgt_agents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    website TEXT,
    x_handle TEXT,
    telegram TEXT,
    github TEXT,
    chain TEXT DEFAULT 'multi',
    category TEXT DEFAULT 'general',  -- defi, social, gaming, infra, devtools, dao, public-goods
    status TEXT DEFAULT 'live',       -- live, building, beta, dead
    logo_url TEXT,
    token_address TEXT,
    token_symbol TEXT,
    submitted_by TEXT,                -- wallet address
    approved BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public Goods directory
CREATE TABLE IF NOT EXISTS pgt_public_goods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    website TEXT,
    github TEXT,
    x_handle TEXT,
    category TEXT DEFAULT 'tool',     -- tool, infra, education, community, protocol, dao
    chain TEXT,
    logo_url TEXT,
    submitted_by TEXT,
    approved BOOLEAN DEFAULT false,
    featured BOOLEAN DEFAULT false,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Builder / Vibecoder profiles
CREATE TABLE IF NOT EXISTS pgt_builders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    bio TEXT,
    x_handle TEXT,
    github TEXT,
    website TEXT,
    wallet_address TEXT,
    skills TEXT[],                     -- ['vibecoder', 'smart-contracts', 'ai-ml', 'frontend', 'design']
    projects TEXT[],                   -- names of projects they built
    avatar_url TEXT,
    featured BOOLEAN DEFAULT false,
    approved BOOLEAN DEFAULT false,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blog articles
CREATE TABLE IF NOT EXISTS pgt_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,             -- markdown
    excerpt TEXT,
    cover_image TEXT,
    author_wallet TEXT,
    author_name TEXT,
    author_x_handle TEXT,
    category TEXT DEFAULT 'news',      -- news, tutorial, analysis, opinion, spotlight
    tags TEXT[],
    status TEXT DEFAULT 'draft',       -- draft, review, published
    published_at TIMESTAMPTZ,
    total_tips INTEGER DEFAULT 0,
    total_claws_earned BIGINT DEFAULT 0,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CLAWS tips on articles
CREATE TABLE IF NOT EXISTS pgt_tips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    article_id UUID REFERENCES pgt_articles(id),
    tipper_wallet TEXT NOT NULL,
    author_wallet TEXT NOT NULL,
    author_split INTEGER DEFAULT 80,  -- % to author (rest to reader)
    total_claws BIGINT NOT NULL,      -- total CLAWS from pool for this tip
    author_claws BIGINT NOT NULL,
    reader_claws BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pgt_agents_category ON pgt_agents(category);
CREATE INDEX IF NOT EXISTS idx_pgt_agents_status ON pgt_agents(status);
CREATE INDEX IF NOT EXISTS idx_pgt_agents_approved ON pgt_agents(approved);
CREATE INDEX IF NOT EXISTS idx_pgt_goods_category ON pgt_public_goods(category);
CREATE INDEX IF NOT EXISTS idx_pgt_builders_approved ON pgt_builders(approved);
CREATE INDEX IF NOT EXISTS idx_pgt_articles_status ON pgt_articles(status);
CREATE INDEX IF NOT EXISTS idx_pgt_articles_category ON pgt_articles(category);
CREATE INDEX IF NOT EXISTS idx_pgt_tips_article ON pgt_tips(article_id);

-- RLS
ALTER TABLE pgt_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgt_public_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgt_builders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgt_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pgt_tips ENABLE ROW LEVEL SECURITY;

-- Public read for all
CREATE POLICY "pgt_agents_read" ON pgt_agents FOR SELECT USING (true);
CREATE POLICY "pgt_goods_read" ON pgt_public_goods FOR SELECT USING (true);
CREATE POLICY "pgt_builders_read" ON pgt_builders FOR SELECT USING (true);
CREATE POLICY "pgt_articles_read" ON pgt_articles FOR SELECT USING (true);
CREATE POLICY "pgt_tips_read" ON pgt_tips FOR SELECT USING (true);

-- Service role write
CREATE POLICY "pgt_agents_write" ON pgt_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pgt_goods_write" ON pgt_public_goods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pgt_builders_write" ON pgt_builders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pgt_articles_write" ON pgt_articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pgt_tips_write" ON pgt_tips FOR ALL USING (true) WITH CHECK (true);
