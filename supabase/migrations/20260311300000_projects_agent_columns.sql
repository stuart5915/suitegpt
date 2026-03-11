-- Add AI Agent columns to the projects table (the real project directory)
-- Previously agent data lived on inclawbator_projects (old token launches).

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS agent_enabled boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS agent_credits integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS agent_persona text,
    ADD COLUMN IF NOT EXISTS agent_posts_per_day integer DEFAULT 2,
    ADD COLUMN IF NOT EXISTS agent_status text DEFAULT 'dormant',
    ADD COLUMN IF NOT EXISTS agent_last_post_at timestamptz,
    ADD COLUMN IF NOT EXISTS agent_total_posts integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS token_symbol text,
    ADD COLUMN IF NOT EXISTS x_access_token text,
    ADD COLUMN IF NOT EXISTS x_refresh_token text;

-- Constrain posts per day to 1-3
ALTER TABLE projects
    ADD CONSTRAINT chk_project_agent_posts_per_day CHECK (agent_posts_per_day BETWEEN 1 AND 3);

-- Constrain agent status values
ALTER TABLE projects
    ADD CONSTRAINT chk_project_agent_status CHECK (agent_status IN ('active', 'dormant', 'paused'));

-- Agent posts log (references projects, not inclawbator_projects)
CREATE TABLE IF NOT EXISTS project_agent_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    tweet_text text NOT NULL,
    tweet_id text,
    credits_cost integer DEFAULT 1,
    status text DEFAULT 'posted',
    error_message text,
    posted_via text DEFAULT '@inclawbator',
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_agent_posts_project ON project_agent_posts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_agent_posts_created ON project_agent_posts(created_at);

-- Atomic credit RPCs for projects table
CREATE OR REPLACE FUNCTION deduct_project_agent_credit(p_project_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance integer;
BEGIN
    UPDATE projects
    SET agent_credits = agent_credits - p_amount
    WHERE id = p_project_id AND agent_credits >= p_amount
    RETURNING agent_credits INTO new_balance;

    IF NOT FOUND THEN
        RETURN -1;
    END IF;

    RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION add_project_agent_credits(p_project_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    new_balance integer;
BEGIN
    UPDATE projects
    SET agent_credits = agent_credits + p_amount
    WHERE id = p_project_id
    RETURNING agent_credits INTO new_balance;

    RETURN COALESCE(new_balance, -1);
END;
$$;
