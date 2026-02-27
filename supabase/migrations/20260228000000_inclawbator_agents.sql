-- Inclawbator AI Agents — Self-Sustaining Heartbeat System
-- Adds agent columns to inclawbator_projects, plus tracking tables for posts & deposits

-- ── A. New columns on inclawbator_projects ──
ALTER TABLE inclawbator_projects
    ADD COLUMN IF NOT EXISTS agent_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS agent_credits integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS agent_persona text,
    ADD COLUMN IF NOT EXISTS agent_posts_per_day integer DEFAULT 4,
    ADD COLUMN IF NOT EXISTS agent_status text DEFAULT 'dormant',
    ADD COLUMN IF NOT EXISTS agent_last_post_at timestamptz,
    ADD COLUMN IF NOT EXISTS agent_total_posts integer DEFAULT 0;

-- Constrain posts_per_day to 1-12
ALTER TABLE inclawbator_projects
    ADD CONSTRAINT chk_agent_posts_per_day CHECK (agent_posts_per_day BETWEEN 1 AND 12);

-- Constrain agent_status values
ALTER TABLE inclawbator_projects
    ADD CONSTRAINT chk_agent_status CHECK (agent_status IN ('active', 'dormant', 'paused'));

-- ── B. Agent posts log ──
CREATE TABLE IF NOT EXISTS inclawbator_agent_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES inclawbator_projects(id) ON DELETE CASCADE,
    tweet_text text NOT NULL,
    tweet_id text,
    credits_cost integer DEFAULT 1,
    status text DEFAULT 'posted',
    error_message text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_posts_project ON inclawbator_agent_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_posts_created ON inclawbator_agent_posts(created_at);

-- ── C. Agent credit deposits ──
CREATE TABLE IF NOT EXISTS inclawbator_agent_deposits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES inclawbator_projects(id) ON DELETE CASCADE,
    depositor_wallet text NOT NULL,
    tx_hash text UNIQUE NOT NULL,
    inclawnch_amount numeric NOT NULL,
    credits_granted integer NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_deposits_project ON inclawbator_agent_deposits(project_id);

-- ── D. Atomic credit RPCs ──

-- Deduct credits atomically, returns new balance or -1 if insufficient
CREATE OR REPLACE FUNCTION deduct_agent_credit(p_project_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance integer;
BEGIN
    UPDATE inclawbator_projects
    SET agent_credits = agent_credits - p_amount
    WHERE id = p_project_id AND agent_credits >= p_amount
    RETURNING agent_credits INTO new_balance;

    IF NOT FOUND THEN
        RETURN -1;
    END IF;

    RETURN new_balance;
END;
$$;

-- Add credits atomically, returns new balance
CREATE OR REPLACE FUNCTION add_agent_credits(p_project_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance integer;
BEGIN
    UPDATE inclawbator_projects
    SET agent_credits = agent_credits + p_amount
    WHERE id = p_project_id
    RETURNING agent_credits INTO new_balance;

    RETURN COALESCE(new_balance, -1);
END;
$$;
