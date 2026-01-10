-- App Promotion Campaigns System
-- Database tables for developers to promote their apps within the SUITE ecosystem

-- =====================================================
-- PROMOTION TIERS (pricing structure)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_promotion_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                        -- 'Starter', 'Growth', 'Boost', 'Featured'
    impressions_included INTEGER NOT NULL,     -- How many ad views included
    cost_suite INTEGER NOT NULL,               -- Cost in SUITE tokens
    includes_homepage BOOLEAN DEFAULT FALSE,   -- Featured tier gets homepage placement
    priority_weight INTEGER DEFAULT 1,         -- Higher = shown more often
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO app_promotion_tiers (name, impressions_included, cost_suite, includes_homepage, priority_weight, description) VALUES
    ('Starter', 1000, 50, false, 1, 'Perfect for testing the waters. Get 1,000 impressions across all SUITE apps.'),
    ('Growth', 10000, 400, false, 2, 'Serious reach. Get 10,000 impressions with priority placement.'),
    ('Boost', 50000, 1500, false, 3, 'Maximum exposure. Get 50,000 impressions with high-priority placement.'),
    ('Featured', 100000, 5000, true, 5, 'The ultimate package. 100,000 impressions PLUS homepage featured placement.');

-- =====================================================
-- PROMOTION CAMPAIGNS (developer-created campaigns)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_promotion_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES suite_apps(id) ON DELETE CASCADE,
    creator_discord_id TEXT NOT NULL,          -- Who created this campaign
    tier_id UUID REFERENCES app_promotion_tiers(id),
    
    -- Campaign details
    title TEXT NOT NULL,                       -- Custom ad headline (max 50 chars)
    description TEXT,                          -- Custom ad description (max 120 chars)
    cta_text TEXT DEFAULT 'Try Now',           -- Call-to-action button text
    custom_image_url TEXT,                     -- Optional custom promo image
    
    -- Budget & spending
    budget_suite INTEGER NOT NULL,             -- Total SUITE allocated
    spent_suite INTEGER DEFAULT 0,             -- SUITE already spent
    impressions_target INTEGER NOT NULL,       -- Target impressions from tier
    impressions_delivered INTEGER DEFAULT 0,   -- Actual impressions served
    
    -- Timing
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'completed', 'cancelled')),
    starts_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ends_at TIMESTAMP WITH TIME ZONE,          -- Optional end date
    
    -- Targeting (future use)
    target_categories TEXT[],                  -- Only show in certain app categories
    exclude_app_ids UUID[],                    -- Don't show in these apps (e.g., competitors)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PROMOTION IMPRESSIONS (tracking each ad view)
-- =====================================================
CREATE TABLE IF NOT EXISTS app_promotion_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES app_promotion_campaigns(id) ON DELETE CASCADE,
    
    -- Where the ad was shown
    shown_in_app_id UUID REFERENCES suite_apps(id),
    shown_on_page TEXT,                        -- 'homepage', 'apps', 'in-app', etc.
    
    -- Who saw it
    viewer_discord_id TEXT,                    -- Optional, if user is logged in
    viewer_ip_hash TEXT,                       -- Hashed IP for deduplication
    viewer_suite_balance INTEGER,              -- Their balance at time of view
    
    -- Interaction
    was_clicked BOOLEAN DEFAULT FALSE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON app_promotion_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_app ON app_promotion_campaigns(app_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_creator ON app_promotion_campaigns(creator_discord_id);
CREATE INDEX IF NOT EXISTS idx_impressions_campaign ON app_promotion_impressions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_impressions_created ON app_promotion_impressions(created_at);

-- =====================================================
-- HELPER VIEW: Active campaigns with remaining budget
-- =====================================================
CREATE OR REPLACE VIEW active_promotion_campaigns AS
SELECT 
    c.*,
    a.name as app_name,
    a.icon_url as app_icon,
    a.slug as app_slug,
    t.name as tier_name,
    t.priority_weight,
    (c.impressions_target - c.impressions_delivered) as impressions_remaining,
    (c.budget_suite - c.spent_suite) as budget_remaining
FROM app_promotion_campaigns c
JOIN suite_apps a ON c.app_id = a.id
LEFT JOIN app_promotion_tiers t ON c.tier_id = t.id
WHERE c.status = 'active'
  AND c.impressions_delivered < c.impressions_target
  AND (c.ends_at IS NULL OR c.ends_at > NOW());

-- =====================================================
-- FUNCTION: Record an impression and update campaign
-- =====================================================
CREATE OR REPLACE FUNCTION record_promotion_impression(
    p_campaign_id UUID,
    p_shown_in_app_id UUID,
    p_shown_on_page TEXT,
    p_viewer_discord_id TEXT DEFAULT NULL,
    p_viewer_ip_hash TEXT DEFAULT NULL,
    p_viewer_suite_balance INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_impression_id UUID;
BEGIN
    -- Insert the impression
    INSERT INTO app_promotion_impressions (
        campaign_id, shown_in_app_id, shown_on_page,
        viewer_discord_id, viewer_ip_hash, viewer_suite_balance
    ) VALUES (
        p_campaign_id, p_shown_in_app_id, p_shown_on_page,
        p_viewer_discord_id, p_viewer_ip_hash, p_viewer_suite_balance
    ) RETURNING id INTO v_impression_id;
    
    -- Update campaign counters
    UPDATE app_promotion_campaigns
    SET 
        impressions_delivered = impressions_delivered + 1,
        updated_at = NOW()
    WHERE id = p_campaign_id;
    
    -- Check if campaign is now complete
    UPDATE app_promotion_campaigns
    SET status = 'completed'
    WHERE id = p_campaign_id
      AND impressions_delivered >= impressions_target;
    
    RETURN v_impression_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION: Record a click on an impression
-- =====================================================
CREATE OR REPLACE FUNCTION record_promotion_click(
    p_impression_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE app_promotion_impressions
    SET was_clicked = TRUE, clicked_at = NOW()
    WHERE id = p_impression_id AND was_clicked = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
