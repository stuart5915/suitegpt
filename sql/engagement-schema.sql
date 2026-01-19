-- ============================================
-- ENGAGEMENT DISCOVERY SYSTEM SCHEMA
-- Smart engagement for growing X/Twitter reach
-- ============================================

-- Engagement Configuration
-- Stores user's search preferences and filters
CREATE TABLE IF NOT EXISTS engagement_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL UNIQUE,

    -- Search criteria
    keywords TEXT[] DEFAULT '{}',           -- e.g., ['web3', 'yield', 'defi']
    hashtags TEXT[] DEFAULT '{}',           -- e.g., ['#buildinpublic', '#crypto']
    target_accounts TEXT[] DEFAULT '{}',    -- e.g., ['@naval', '@pmarca']

    -- Filters
    min_followers INTEGER DEFAULT 100,      -- Don't engage with < 100 followers
    max_followers INTEGER DEFAULT 100000,   -- Don't engage with > 100k (won't notice you)
    min_engagement INTEGER DEFAULT 5,       -- Post should have some traction (likes)
    max_age_hours INTEGER DEFAULT 24,       -- Don't reply to old posts

    -- Tracking
    total_engaged INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Engagement Opportunities (cached search results)
-- Stores found posts to avoid duplicate API calls
CREATE TABLE IF NOT EXISTS engagement_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL,

    -- Tweet info
    tweet_id TEXT NOT NULL,
    tweet_url TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_followers INTEGER DEFAULT 0,
    author_avatar TEXT,
    content TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL,

    -- Metrics
    likes INTEGER DEFAULT 0,
    retweets INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,

    -- AI analysis
    relevance_score INTEGER DEFAULT 50,     -- 0-100
    engagement_potential TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
    suggested_angle TEXT,                   -- AI suggestion for how to reply
    matched_keywords TEXT[] DEFAULT '{}',   -- Why this was found

    -- Status
    status TEXT DEFAULT 'pending',          -- 'pending', 'engaged', 'skipped', 'expired'

    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',

    UNIQUE(telegram_id, tweet_id)
);

-- Engagement History
-- Tracks all actions taken for learning
CREATE TABLE IF NOT EXISTS engagement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL,

    -- Reference
    tweet_id TEXT NOT NULL,
    opportunity_id UUID REFERENCES engagement_opportunities(id),

    -- Action taken
    action TEXT NOT NULL,                   -- 'engaged', 'skipped'
    skip_reason TEXT,                       -- 'not_relevant', 'wrong_audience', 'too_big', 'too_small', 'already_crowded'
    reply_content TEXT,                     -- What was posted (if engaged)

    -- Tweet metadata at time of action (for learning)
    author_handle TEXT,
    author_followers INTEGER,
    matched_keywords TEXT[] DEFAULT '{}',
    content_preview TEXT,                   -- First 200 chars of tweet
    had_media BOOLEAN DEFAULT FALSE,

    -- Result tracking (updated later if engaged)
    result_likes INTEGER,
    result_replies INTEGER,
    author_followed_back BOOLEAN,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keyword Effectiveness Tracking
-- Tracks which keywords lead to good engagement
CREATE TABLE IF NOT EXISTS keyword_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL,
    keyword TEXT NOT NULL,

    -- Stats
    times_matched INTEGER DEFAULT 0,
    times_engaged INTEGER DEFAULT 0,
    times_skipped INTEGER DEFAULT 0,
    skip_reasons JSONB DEFAULT '{}',        -- {"not_relevant": 3, "wrong_audience": 1}

    -- Calculated
    skip_rate DECIMAL(5,4) DEFAULT 0,       -- 0.0000 to 1.0000

    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(telegram_id, keyword)
);

-- Author Soft-Block List
-- Authors to exclude from future results
CREATE TABLE IF NOT EXISTS blocked_authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL,
    author_handle TEXT NOT NULL,
    skip_count INTEGER DEFAULT 0,
    last_skip_reason TEXT,
    blocked_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(telegram_id, author_handle)
);

-- Seen Tweets (for deduplication)
-- Tracks which tweets user has already seen
CREATE TABLE IF NOT EXISTS seen_tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id TEXT NOT NULL,
    tweet_id TEXT NOT NULL,
    seen_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(telegram_id, tweet_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_engagement_config_telegram ON engagement_config(telegram_id);
CREATE INDEX IF NOT EXISTS idx_engagement_opportunities_telegram ON engagement_opportunities(telegram_id);
CREATE INDEX IF NOT EXISTS idx_engagement_opportunities_status ON engagement_opportunities(telegram_id, status);
CREATE INDEX IF NOT EXISTS idx_engagement_history_telegram ON engagement_history(telegram_id);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action ON engagement_history(telegram_id, action);
CREATE INDEX IF NOT EXISTS idx_keyword_stats_telegram ON keyword_stats(telegram_id);
CREATE INDEX IF NOT EXISTS idx_blocked_authors_telegram ON blocked_authors(telegram_id);
CREATE INDEX IF NOT EXISTS idx_seen_tweets_telegram ON seen_tweets(telegram_id, tweet_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update keyword stats when engagement happens
CREATE OR REPLACE FUNCTION update_keyword_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- For each matched keyword in the engagement history
    IF NEW.matched_keywords IS NOT NULL AND array_length(NEW.matched_keywords, 1) > 0 THEN
        FOR i IN 1..array_length(NEW.matched_keywords, 1) LOOP
            INSERT INTO keyword_stats (telegram_id, keyword, times_matched, times_engaged, times_skipped, skip_rate)
            VALUES (
                NEW.telegram_id,
                NEW.matched_keywords[i],
                1,
                CASE WHEN NEW.action = 'engaged' THEN 1 ELSE 0 END,
                CASE WHEN NEW.action = 'skipped' THEN 1 ELSE 0 END,
                CASE WHEN NEW.action = 'skipped' THEN 1.0 ELSE 0.0 END
            )
            ON CONFLICT (telegram_id, keyword)
            DO UPDATE SET
                times_matched = keyword_stats.times_matched + 1,
                times_engaged = keyword_stats.times_engaged + CASE WHEN NEW.action = 'engaged' THEN 1 ELSE 0 END,
                times_skipped = keyword_stats.times_skipped + CASE WHEN NEW.action = 'skipped' THEN 1 ELSE 0 END,
                skip_rate = (keyword_stats.times_skipped + CASE WHEN NEW.action = 'skipped' THEN 1 ELSE 0 END)::decimal
                           / (keyword_stats.times_matched + 1)::decimal,
                skip_reasons = CASE
                    WHEN NEW.action = 'skipped' AND NEW.skip_reason IS NOT NULL THEN
                        jsonb_set(
                            COALESCE(keyword_stats.skip_reasons, '{}'),
                            ARRAY[NEW.skip_reason],
                            (COALESCE((keyword_stats.skip_reasons->>NEW.skip_reason)::int, 0) + 1)::text::jsonb
                        )
                    ELSE keyword_stats.skip_reasons
                END,
                updated_at = NOW();
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for keyword stats update
DROP TRIGGER IF EXISTS engagement_keyword_stats_trigger ON engagement_history;
CREATE TRIGGER engagement_keyword_stats_trigger
AFTER INSERT ON engagement_history
FOR EACH ROW
EXECUTE FUNCTION update_keyword_stats();

-- Auto-block authors with multiple skips
CREATE OR REPLACE FUNCTION update_blocked_authors()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action = 'skipped' AND NEW.author_handle IS NOT NULL THEN
        INSERT INTO blocked_authors (telegram_id, author_handle, skip_count, last_skip_reason)
        VALUES (NEW.telegram_id, NEW.author_handle, 1, NEW.skip_reason)
        ON CONFLICT (telegram_id, author_handle)
        DO UPDATE SET
            skip_count = blocked_authors.skip_count + 1,
            last_skip_reason = NEW.skip_reason,
            blocked_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for blocked authors
DROP TRIGGER IF EXISTS engagement_blocked_authors_trigger ON engagement_history;
CREATE TRIGGER engagement_blocked_authors_trigger
AFTER INSERT ON engagement_history
FOR EACH ROW
EXECUTE FUNCTION update_blocked_authors();

-- Update engagement config stats
CREATE OR REPLACE FUNCTION update_engagement_config_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE engagement_config
    SET
        total_engaged = total_engaged + CASE WHEN NEW.action = 'engaged' THEN 1 ELSE 0 END,
        total_skipped = total_skipped + CASE WHEN NEW.action = 'skipped' THEN 1 ELSE 0 END,
        updated_at = NOW()
    WHERE telegram_id = NEW.telegram_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for config stats
DROP TRIGGER IF EXISTS engagement_config_stats_trigger ON engagement_history;
CREATE TRIGGER engagement_config_stats_trigger
AFTER INSERT ON engagement_history
FOR EACH ROW
EXECUTE FUNCTION update_engagement_config_stats();
