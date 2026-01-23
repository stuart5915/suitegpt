-- ================================================
-- CADENCE EXTENSIONS - DATABASE SCHEMA
-- Created: 2026-01-23
-- ================================================

-- ================================
-- EXTENSION REGISTRY
-- ================================

CREATE TABLE IF NOT EXISTS cadence_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT NOT NULL,
    credit_cost JSONB DEFAULT '{}',
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    is_premium BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- USER EXTENSIONS
-- ================================

CREATE TABLE IF NOT EXISTS user_extensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    extension_slug TEXT NOT NULL REFERENCES cadence_extensions(slug),
    enabled BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    credits_used_today INTEGER DEFAULT 0,
    credits_used_month INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, extension_slug)
);

-- ================================
-- EXTENSION USAGE TRACKING
-- ================================

CREATE TABLE IF NOT EXISTS extension_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    extension_slug TEXT NOT NULL REFERENCES cadence_extensions(slug),
    action TEXT NOT NULL,
    credits_spent INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- SOCIAL ENGAGER TABLES
-- ================================

CREATE TABLE IF NOT EXISTS engagement_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('x', 'instagram', 'linkedin')),
    type TEXT NOT NULL CHECK (type IN ('keyword', 'account', 'hashtag')),
    target TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('like', 'reply', 'retweet', 'follow')),
    reply_template TEXT,
    is_active BOOLEAN DEFAULT true,
    daily_limit INTEGER DEFAULT 50,
    actions_today INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES engagement_rules(id) ON DELETE CASCADE,
    post_url TEXT,
    post_content TEXT,
    action_taken TEXT NOT NULL,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- IMAGE GENERATOR TABLES
-- ================================

CREATE TABLE IF NOT EXISTS image_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    style TEXT DEFAULT 'minimal',
    brand_colors JSONB DEFAULT '[]',
    font_style TEXT DEFAULT 'modern',
    layout TEXT DEFAULT 'centered',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    template_id UUID REFERENCES image_templates(id),
    prompt TEXT NOT NULL,
    style TEXT,
    image_url TEXT,
    thumbnail_url TEXT,
    credits_used INTEGER DEFAULT 50,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- THREAD WRITER TABLES
-- ================================

CREATE TABLE IF NOT EXISTS threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    project_id UUID,
    title TEXT NOT NULL,
    source_content TEXT,
    source_url TEXT,
    tweets JSONB DEFAULT '[]',
    total_tweets INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'posted')),
    scheduled_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- ANALYTICS DASHBOARD TABLES
-- ================================

CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    date DATE NOT NULL,
    followers INTEGER DEFAULT 0,
    following INTEGER DEFAULT 0,
    posts INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    profile_visits INTEGER DEFAULT 0,
    link_clicks INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, date)
);

CREATE TABLE IF NOT EXISTS post_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID,
    user_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    post_url TEXT,
    impressions INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    reach INTEGER DEFAULT 0,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- INDEXES
-- ================================

CREATE INDEX IF NOT EXISTS idx_user_extensions_user_id ON user_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_extensions_slug ON user_extensions(extension_slug);
CREATE INDEX IF NOT EXISTS idx_extension_usage_user_id ON extension_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_extension_usage_slug ON extension_usage(extension_slug);
CREATE INDEX IF NOT EXISTS idx_extension_usage_created ON extension_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_rules_user_id ON engagement_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_engagement_logs_rule_id ON engagement_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON threads(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_user ON analytics_snapshots(user_id, platform, date);
CREATE INDEX IF NOT EXISTS idx_post_analytics_content ON post_analytics(content_item_id);

-- ================================
-- ROW LEVEL SECURITY
-- ================================

ALTER TABLE user_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extension_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own extensions" ON user_extensions FOR SELECT USING (true);
CREATE POLICY "Users can manage own extensions" ON user_extensions FOR ALL USING (true);

CREATE POLICY "Users can view own usage" ON extension_usage FOR SELECT USING (true);
CREATE POLICY "Users can insert own usage" ON extension_usage FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage own engagement rules" ON engagement_rules FOR ALL USING (true);
CREATE POLICY "Users can view own engagement logs" ON engagement_logs FOR SELECT USING (true);
CREATE POLICY "Users can insert engagement logs" ON engagement_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage own image templates" ON image_templates FOR ALL USING (true);
CREATE POLICY "Users can manage own generated images" ON generated_images FOR ALL USING (true);

CREATE POLICY "Users can manage own threads" ON threads FOR ALL USING (true);

CREATE POLICY "Users can manage own analytics" ON analytics_snapshots FOR ALL USING (true);
CREATE POLICY "Users can manage own post analytics" ON post_analytics FOR ALL USING (true);

-- ================================
-- SEED DEFAULT EXTENSIONS
-- ================================

INSERT INTO cadence_extensions (slug, name, description, icon, category, credit_cost, features, is_active, is_premium)
VALUES
    ('social-engager', 'Social Engager', 'Auto-like, reply, and engage with posts based on keywords and accounts', '💬', 'engagement', '{"per_day": 100}', '["Keyword-based engagement", "Account targeting", "Auto-replies with AI", "Warm up leads before DMs", "Daily limits & safety controls"]', true, false),
    ('image-generator', 'AI Image Generator', 'Generate stunning social media graphics with AI', '🎨', 'content', '{"per_use": 50}', '["Brand template library", "Consistent visual style", "Multiple aspect ratios", "Auto-sync with Cadence posts", "Custom style training"]', true, false),
    ('thread-writer', 'Thread Writer', 'Turn blog posts and ideas into engaging Twitter threads', '🧵', 'content', '{"per_use": 25}', '["Blog to thread conversion", "Hook optimization", "CTA insertion", "Character counting", "Schedule via Cadence"]', true, false),
    ('analytics-dashboard', 'Analytics Dashboard', 'Cross-platform social analytics and insights', '📊', 'analytics', '{"per_month": 500, "free": true}', '["Multi-platform metrics", "Post performance tracking", "Audience insights", "Best posting times", "Export reports"]', true, false),
    ('hashtag-optimizer', 'Hashtag Optimizer', 'AI-powered hashtag suggestions for maximum reach', '#️⃣', 'growth', '{"free": true}', '["Platform-specific tags", "Performance tracking", "Trending detection", "Competition analysis", "Auto-add to posts"]', true, false),
    ('comment-responder', 'Comment Responder', 'AI drafts replies to comments on your posts', '💭', 'engagement', '{"per_use": 10}', '["AI-generated replies", "Tone matching", "Approval workflow", "Bulk respond", "Sentiment analysis"]', false, true),
    ('trend-surfer', 'Trend Surfer', 'Monitor trending topics and create timely content', '🌊', 'content', '{"per_day": 50}', '["Niche trend monitoring", "Content suggestions", "Auto-draft posts", "Viral potential scoring", "Real-time alerts"]', false, true),
    ('link-in-bio', 'Link in Bio', 'Dynamic link-in-bio page with analytics', '🔗', 'growth', '{"per_month": 200, "free": true}', '["Customizable page", "Click tracking", "A/B testing", "Auto-update from campaigns", "Custom domain support"]', false, false),
    ('dm-sequence-builder', 'DM Sequence Builder', 'Automated DM sequences for lead nurturing', '📬', 'engagement', '{"per_use": 20}', '["Multi-step sequences", "AI personalization", "Trigger conditions", "Response handling", "Analytics & tracking"]', false, true)
ON CONFLICT (slug) DO NOTHING;

-- ================================
-- HELPER FUNCTIONS
-- ================================

-- Function to reset daily usage counters (run via cron)
CREATE OR REPLACE FUNCTION reset_daily_extension_usage()
RETURNS void AS $$
BEGIN
    UPDATE user_extensions SET credits_used_today = 0;
    UPDATE engagement_rules SET actions_today = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly usage counters (run via cron on 1st)
CREATE OR REPLACE FUNCTION reset_monthly_extension_usage()
RETURNS void AS $$
BEGIN
    UPDATE user_extensions SET credits_used_month = 0;
END;
$$ LANGUAGE plpgsql;
