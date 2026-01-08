-- Ad Events Table for Secure Postback System
-- Run this in your Supabase SQL Editor (rdsmdywbdiskxknluiym)

CREATE TABLE IF NOT EXISTS ad_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discord_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('started', 'completed', 'credited', 'failed')),
    suite_amount NUMERIC DEFAULT 2,
    adsterra_subid TEXT,
    ip_address TEXT,
    user_agent TEXT,
    credited BOOLEAN DEFAULT FALSE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    credited_at TIMESTAMPTZ
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_ad_events_discord_id ON ad_events(discord_id);
CREATE INDEX IF NOT EXISTS idx_ad_events_credited ON ad_events(credited) WHERE credited = FALSE;
CREATE INDEX IF NOT EXISTS idx_ad_events_subid ON ad_events(adsterra_subid);

-- RLS Policies
ALTER TABLE ad_events ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for API)
CREATE POLICY "Service role has full access to ad_events" ON ad_events
    FOR ALL USING (true);

-- Function to credit user and log event
CREATE OR REPLACE FUNCTION credit_user_from_ad(
    p_discord_id TEXT,
    p_subid TEXT,
    p_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_event_id UUID;
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_suite_amount NUMERIC := 2;
BEGIN
    -- Check if this subid was already credited (prevent double-credit)
    IF EXISTS (SELECT 1 FROM ad_events WHERE adsterra_subid = p_subid AND credited = TRUE) THEN
        RETURN json_build_object('success', false, 'error', 'Already credited');
    END IF;

    -- Create event record
    INSERT INTO ad_events (discord_id, event_type, adsterra_subid, ip_address, user_agent, suite_amount)
    VALUES (p_discord_id, 'completed', p_subid, p_ip, p_user_agent, v_suite_amount)
    RETURNING id INTO v_event_id;

    -- Get or create user credits
    INSERT INTO user_credits (discord_id, suite_balance, free_actions_used)
    VALUES (p_discord_id, 0, 0)
    ON CONFLICT (discord_id) DO NOTHING;

    -- Get current balance
    SELECT suite_balance INTO v_current_balance 
    FROM user_credits 
    WHERE discord_id = p_discord_id;

    v_new_balance := COALESCE(v_current_balance, 0) + v_suite_amount;

    -- Credit the user
    UPDATE user_credits 
    SET suite_balance = v_new_balance,
        total_ads_watched = COALESCE(total_ads_watched, 0) + 1,
        last_ad_watched = NOW()
    WHERE discord_id = p_discord_id;

    -- Mark event as credited
    UPDATE ad_events 
    SET credited = TRUE, 
        credited_at = NOW(),
        event_type = 'credited'
    WHERE id = v_event_id;

    RETURN json_build_object(
        'success', true, 
        'event_id', v_event_id,
        'discord_id', p_discord_id,
        'amount', v_suite_amount,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    -- Log the failure
    UPDATE ad_events 
    SET event_type = 'failed',
        error_message = SQLERRM,
        retry_count = retry_count + 1
    WHERE id = v_event_id;
    
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION credit_user_from_ad TO service_role;

COMMENT ON TABLE ad_events IS 'Logs all ad interactions for auditing and retry';
COMMENT ON FUNCTION credit_user_from_ad IS 'Safely credits user SUITE from ad callback with duplicate protection';
