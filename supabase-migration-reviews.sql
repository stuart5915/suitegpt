-- =============================================
-- SUITE App Reviews System
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Review Campaigns Table
-- Stores settings for when app owners want to pay for reviews
CREATE TABLE IF NOT EXISTS review_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    developer_discord_id TEXT NOT NULL,
    suite_per_review INTEGER NOT NULL DEFAULT 50,
    min_usage_seconds INTEGER NOT NULL DEFAULT 300, -- 5 minutes default
    total_budget INTEGER NOT NULL DEFAULT 500,
    remaining_budget INTEGER NOT NULL DEFAULT 500,
    max_reviews INTEGER, -- NULL = unlimited
    reviews_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'depleted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. App Reviews Table
-- Stores actual user reviews
CREATE TABLE IF NOT EXISTS app_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES review_campaigns(id) ON DELETE SET NULL,
    reviewer_discord_id TEXT NOT NULL,
    reviewer_username TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    usage_time_seconds INTEGER DEFAULT 0,
    suite_earned INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate reviews from same user on same app
    UNIQUE(app_id, reviewer_discord_id)
);

-- 3. Enable Row Level Security
ALTER TABLE review_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_reviews ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for review_campaigns
-- Anyone can read active campaigns
CREATE POLICY "Anyone can view active review campaigns"
    ON review_campaigns FOR SELECT
    USING (status = 'active');

-- Developers can manage their own campaigns
CREATE POLICY "Developers can manage their review campaigns"
    ON review_campaigns FOR ALL
    USING (true);

-- 5. RLS Policies for app_reviews
-- Anyone can read reviews
CREATE POLICY "Anyone can view reviews"
    ON app_reviews FOR SELECT
    USING (true);

-- Users can insert their own reviews
CREATE POLICY "Users can submit reviews"
    ON app_reviews FOR INSERT
    WITH CHECK (true);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_review_campaigns_app_id ON review_campaigns(app_id);
CREATE INDEX IF NOT EXISTS idx_review_campaigns_developer ON review_campaigns(developer_discord_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_app_id ON app_reviews(app_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_reviewer ON app_reviews(reviewer_discord_id);
CREATE INDEX IF NOT EXISTS idx_app_reviews_rating ON app_reviews(rating);

-- 7. Function to update campaign stats when review is added
CREATE OR REPLACE FUNCTION update_review_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the campaign stats
    UPDATE review_campaigns
    SET 
        reviews_count = reviews_count + 1,
        remaining_budget = remaining_budget - NEW.suite_earned,
        status = CASE 
            WHEN remaining_budget - NEW.suite_earned <= 0 THEN 'depleted'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = NEW.campaign_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Trigger to auto-update campaign stats
DROP TRIGGER IF EXISTS trigger_update_review_campaign ON app_reviews;
CREATE TRIGGER trigger_update_review_campaign
    AFTER INSERT ON app_reviews
    FOR EACH ROW
    WHEN (NEW.campaign_id IS NOT NULL)
    EXECUTE FUNCTION update_review_campaign_stats();

-- Done! ✅
