-- =====================================================
-- Quest Board System
-- Bounty system for the SUITE agent swarm
-- =====================================================

CREATE TABLE IF NOT EXISTS quest_board (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward_credits DECIMAL(12, 4) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'completed', 'cancelled')),
    category TEXT CHECK (category IS NULL OR category IN ('feature', 'bug', 'content', 'app_idea', 'improvement', 'marketing')),
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    role_match TEXT,

    created_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    created_by_type TEXT DEFAULT 'human' CHECK (created_by_type IN ('human', 'agent', 'system')),

    claimed_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,

    completed_by UUID REFERENCES factory_users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    completion_proof TEXT,

    auto_assigned BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quest_board_status ON quest_board(status);
CREATE INDEX IF NOT EXISTS idx_quest_board_role ON quest_board(role_match) WHERE role_match IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quest_board_priority ON quest_board(priority DESC) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_quest_board_claimed_by ON quest_board(claimed_by) WHERE claimed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quest_board_created_at ON quest_board(created_at DESC);

-- RLS
ALTER TABLE quest_board ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view quests" ON quest_board
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert quests" ON quest_board
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update quests" ON quest_board
    FOR UPDATE USING (auth.role() = 'service_role');

-- =====================================================
-- claim_quest: Atomically claim a quest for an agent
-- =====================================================
CREATE OR REPLACE FUNCTION claim_quest(
    p_quest_id UUID,
    p_agent_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_quest quest_board;
BEGIN
    SELECT * INTO v_quest
    FROM quest_board
    WHERE id = p_quest_id
    FOR UPDATE;

    IF v_quest IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quest not found');
    END IF;

    IF v_quest.status != 'open' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quest already claimed or completed');
    END IF;

    UPDATE quest_board
    SET status = 'claimed',
        claimed_by = p_agent_id,
        claimed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_quest_id;

    UPDATE factory_users
    SET agent_status = 'working',
        last_active_at = NOW()
    WHERE id = p_agent_id AND is_agent = true;

    RETURN jsonb_build_object('success', true, 'quest_id', p_quest_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- complete_quest: Mark done and pay out credits
-- =====================================================
CREATE OR REPLACE FUNCTION complete_quest(
    p_quest_id UUID,
    p_agent_id UUID,
    p_proof TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_quest quest_board;
    v_agent factory_users;
    v_reward DECIMAL;
BEGIN
    SELECT * INTO v_quest FROM quest_board WHERE id = p_quest_id;

    IF v_quest IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quest not found');
    END IF;

    IF v_quest.status != 'claimed' OR v_quest.claimed_by != p_agent_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Quest not claimed by this agent');
    END IF;

    v_reward := v_quest.reward_credits;

    UPDATE quest_board
    SET status = 'completed',
        completed_by = p_agent_id,
        completed_at = NOW(),
        completion_proof = p_proof,
        updated_at = NOW()
    WHERE id = p_quest_id;

    SELECT * INTO v_agent FROM factory_users WHERE id = p_agent_id;

    -- Pay agent credits if they have a wallet
    IF v_agent.owner_wallet IS NOT NULL AND v_reward > 0 THEN
        PERFORM add_suite_credits(
            v_agent.owner_wallet,
            v_reward,
            'builder_earning',
            'Quest reward: ' || v_quest.title
        );
    END IF;

    UPDATE factory_users
    SET total_credits_earned = COALESCE(total_credits_earned, 0) + v_reward,
        agent_status = 'idle',
        last_active_at = NOW()
    WHERE id = p_agent_id;

    RETURN jsonb_build_object(
        'success', true,
        'quest_id', p_quest_id,
        'reward', v_reward
    );
END;
$$ LANGUAGE plpgsql;
