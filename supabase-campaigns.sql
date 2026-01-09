-- App Campaigns System
-- Developers pay SUITE to run user acquisition campaigns

-- Campaign definitions
CREATE TABLE IF NOT EXISTS app_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID REFERENCES suite_apps(id) ON DELETE CASCADE,
    developer_discord_id TEXT NOT NULL,
    
    -- Rewards
    suite_per_claim INTEGER NOT NULL DEFAULT 100,
    total_budget INTEGER NOT NULL,
    remaining_budget INTEGER NOT NULL,
    
    -- Requirements (toggles)
    require_time BOOLEAN DEFAULT false,
    min_time_seconds INTEGER DEFAULT 0,      -- e.g., 600 = 10 min
    require_actions BOOLEAN DEFAULT false,
    min_actions INTEGER DEFAULT 0,           -- e.g., 100 unique actions
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'depleted', 'expired')),
    max_claims INTEGER,                       -- Optional limit
    claims_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ                    -- Optional expiry
);

-- User progress tracking
CREATE TABLE IF NOT EXISTS campaign_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES app_campaigns(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    
    -- Progress tracking
    time_spent_seconds INTEGER DEFAULT 0,
    unique_actions INTEGER DEFAULT 0,
    action_hashes TEXT[] DEFAULT '{}',       -- Store hashes of unique actions
    
    -- Claim status
    claimed BOOLEAN DEFAULT false,
    claimed_at TIMESTAMPTZ,
    
    -- Timestamps
    first_open TIMESTAMPTZ DEFAULT NOW(),
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(campaign_id, discord_id)
);

-- RLS Policies
ALTER TABLE app_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_progress ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (to allow re-running)
DROP POLICY IF EXISTS "read_active_campaigns" ON app_campaigns;
DROP POLICY IF EXISTS "manage_own_campaigns" ON app_campaigns;
DROP POLICY IF EXISTS "manage_own_progress" ON campaign_progress;

-- Anyone can read active campaigns
CREATE POLICY "read_active_campaigns" ON app_campaigns
    FOR SELECT USING (status = 'active');

-- Developers can manage their own campaigns
CREATE POLICY "manage_own_campaigns" ON app_campaigns
    FOR ALL USING (auth.uid()::text = developer_discord_id);

-- Users can read/update their own progress
CREATE POLICY "manage_own_progress" ON campaign_progress
    FOR ALL USING (true);  -- Will be controlled via service key

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_app ON app_campaigns(app_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON app_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_progress_user ON campaign_progress(discord_id);
CREATE INDEX IF NOT EXISTS idx_progress_campaign ON campaign_progress(campaign_id);

-- Function to claim campaign reward
CREATE OR REPLACE FUNCTION claim_campaign_reward(
    p_campaign_id UUID,
    p_discord_id TEXT
) RETURNS JSONB AS $$
DECLARE
    v_campaign app_campaigns%ROWTYPE;
    v_progress campaign_progress%ROWTYPE;
    v_result JSONB;
BEGIN
    -- Get campaign
    SELECT * INTO v_campaign FROM app_campaigns WHERE id = p_campaign_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
    END IF;
    
    IF v_campaign.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campaign not active');
    END IF;
    
    IF v_campaign.remaining_budget < v_campaign.suite_per_claim THEN
        RETURN jsonb_build_object('success', false, 'error', 'Campaign budget depleted');
    END IF;
    
    -- Get user progress
    SELECT * INTO v_progress FROM campaign_progress 
    WHERE campaign_id = p_campaign_id AND discord_id = p_discord_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'No progress found - open the app first');
    END IF;
    
    IF v_progress.claimed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already claimed');
    END IF;
    
    -- Check requirements
    IF v_campaign.require_time AND v_progress.time_spent_seconds < v_campaign.min_time_seconds THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Not enough time',
            'current', v_progress.time_spent_seconds,
            'required', v_campaign.min_time_seconds
        );
    END IF;
    
    IF v_campaign.require_actions AND v_progress.unique_actions < v_campaign.min_actions THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', 'Not enough actions',
            'current', v_progress.unique_actions,
            'required', v_campaign.min_actions
        );
    END IF;
    
    -- All checks passed - credit user
    UPDATE campaign_progress 
    SET claimed = true, claimed_at = NOW() 
    WHERE id = v_progress.id;
    
    UPDATE app_campaigns 
    SET remaining_budget = remaining_budget - suite_per_claim,
        claims_count = claims_count + 1,
        status = CASE 
            WHEN remaining_budget - suite_per_claim <= 0 THEN 'depleted'
            ELSE status 
        END
    WHERE id = p_campaign_id;
    
    -- Credit to user_credits
    INSERT INTO user_credits (discord_id, balance, free_actions, last_updated)
    VALUES (p_discord_id, v_campaign.suite_per_claim, 0, NOW())
    ON CONFLICT (discord_id) DO UPDATE
    SET balance = user_credits.balance + v_campaign.suite_per_claim,
        last_updated = NOW();
    
    RETURN jsonb_build_object(
        'success', true, 
        'amount', v_campaign.suite_per_claim,
        'message', 'Reward claimed!'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
