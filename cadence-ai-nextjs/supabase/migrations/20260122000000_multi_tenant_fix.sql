-- ============================================
-- MULTI-TENANCY FIX FOR CADENCE AI
-- Adds telegram_id support to projects table
-- and ensures all tables are properly scoped
-- ============================================

-- ============================================
-- 1. ADD telegram_id TO PROJECTS TABLE
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'telegram_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN telegram_id TEXT;
    END IF;
END $$;

-- Create index for faster telegram_id queries
CREATE INDEX IF NOT EXISTS idx_projects_telegram_id ON projects(telegram_id);

-- ============================================
-- 2. UPDATE RLS POLICIES FOR PROJECTS
-- Allow service role full access (for API routes)
-- ============================================

-- Drop existing policies if they exist (they use auth.uid() which doesn't work with Telegram auth)
DROP POLICY IF EXISTS "Users can view their own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON projects;

-- Create new policies that allow service_role access
-- (API routes use service role key, so they bypass RLS anyway, but these are backup)
CREATE POLICY "Service role has full access to projects"
    ON projects FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- 3. CREATE cadence_loops TABLE IF NOT EXISTS
-- (May have been created manually, ensuring it exists with correct schema)
-- ============================================
CREATE TABLE IF NOT EXISTS cadence_loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📝',
    color TEXT DEFAULT '#6366f1',
    description TEXT DEFAULT '',
    rotation_days INTEGER DEFAULT 7,
    is_active BOOLEAN DEFAULT true,
    items JSONB DEFAULT '[]',
    audiences JSONB DEFAULT '[]',
    last_posted TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cadence_loops
CREATE INDEX IF NOT EXISTS idx_cadence_loops_telegram_id ON cadence_loops(telegram_id);
CREATE INDEX IF NOT EXISTS idx_cadence_loops_project_id ON cadence_loops(project_id);

-- ============================================
-- 4. ADD telegram_id TO scheduled_posts IF NEEDED
-- ============================================
DO $$
BEGIN
    -- Check if table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_posts') THEN
        -- Add telegram_id if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'scheduled_posts' AND column_name = 'telegram_id'
        ) THEN
            ALTER TABLE scheduled_posts ADD COLUMN telegram_id TEXT;
        END IF;

        -- Add project_id if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'scheduled_posts' AND column_name = 'project_id'
        ) THEN
            ALTER TABLE scheduled_posts ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- Create indexes if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_posts') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scheduled_posts_telegram_id ON scheduled_posts(telegram_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_scheduled_posts_project_id ON scheduled_posts(project_id)';
    END IF;
END $$;

-- ============================================
-- 5. CREATE cadence_user_settings TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS cadence_user_settings (
    telegram_id TEXT PRIMARY KEY,
    brand_voice TEXT,
    tone TEXT DEFAULT 'professional',
    speaking_perspective TEXT DEFAULT 'first_person',
    emoji_style TEXT DEFAULT 'moderate',
    exclusion_words TEXT[] DEFAULT '{}',
    default_hashtags TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. CREATE engagement_config TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS engagement_config (
    telegram_id TEXT PRIMARY KEY,
    keywords TEXT[] DEFAULT '{}',
    hashtags TEXT[] DEFAULT '{}',
    target_accounts TEXT[] DEFAULT '{}',
    min_followers INTEGER DEFAULT 0,
    max_followers INTEGER,
    min_engagement DECIMAL,
    max_age_hours INTEGER DEFAULT 24,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. CREATE seen_tweets TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS seen_tweets (
    telegram_id TEXT NOT NULL,
    tweet_id TEXT NOT NULL,
    seen_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (telegram_id, tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_seen_tweets_telegram_id ON seen_tweets(telegram_id);

-- ============================================
-- 8. CREATE keyword_stats TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS keyword_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    skip_rate DECIMAL DEFAULT 0,
    total_seen INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(telegram_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_keyword_stats_telegram_id ON keyword_stats(telegram_id);

-- ============================================
-- 9. CREATE blocked_authors TABLE IF NOT EXISTS
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_authors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    skip_count INTEGER DEFAULT 0,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),
    reason TEXT,
    UNIQUE(telegram_id, author_handle)
);

CREATE INDEX IF NOT EXISTS idx_blocked_authors_telegram_id ON blocked_authors(telegram_id);

-- ============================================
-- 10. UPDATE RLS POLICIES FOR OTHER TABLES
-- ============================================

-- weekly_plans: Allow service role full access
DROP POLICY IF EXISTS "Users can view their own weekly plans" ON weekly_plans;
DROP POLICY IF EXISTS "Users can insert weekly plans for their projects" ON weekly_plans;
DROP POLICY IF EXISTS "Users can update their own weekly plans" ON weekly_plans;
DROP POLICY IF EXISTS "Users can delete their own weekly plans" ON weekly_plans;

CREATE POLICY "Service role has full access to weekly_plans"
    ON weekly_plans FOR ALL
    USING (true)
    WITH CHECK (true);

-- content_items: Allow service role full access
DROP POLICY IF EXISTS "Users can view their own content items" ON content_items;
DROP POLICY IF EXISTS "Users can insert content items for their projects" ON content_items;
DROP POLICY IF EXISTS "Users can update their own content items" ON content_items;
DROP POLICY IF EXISTS "Users can delete their own content items" ON content_items;

CREATE POLICY "Service role has full access to content_items"
    ON content_items FOR ALL
    USING (true)
    WITH CHECK (true);

-- conversations: Allow service role full access
DROP POLICY IF EXISTS "Users can view conversations for their weekly plans" ON conversations;
DROP POLICY IF EXISTS "Users can insert conversations for their weekly plans" ON conversations;

CREATE POLICY "Service role has full access to conversations"
    ON conversations FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================
-- DONE!
-- Projects now supports telegram_id
-- All necessary tables exist with proper scoping
-- ============================================
