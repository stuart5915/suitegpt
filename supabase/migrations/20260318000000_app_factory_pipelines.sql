-- App Factory — tracks each daily incubation through the 8-step pipeline

CREATE TABLE IF NOT EXISTS app_factory_pipelines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- App info
    app_name text NOT NULL CHECK (char_length(app_name) BETWEEN 2 AND 60),
    app_slug text,
    app_description text,

    -- Token info
    token_symbol text,
    token_address text,
    token_utility text,

    -- Staking
    staking_address text,

    -- Funding
    claws_funded numeric DEFAULT 0,

    -- Tweet / poll
    tweet_id text,
    poll_tweet_id text,
    poll_results jsonb,
    poll_winner text,
    poll_votes integer DEFAULT 0,

    -- Pipeline steps (booleans)
    step_app boolean NOT NULL DEFAULT false,
    step_token boolean NOT NULL DEFAULT false,
    step_pool boolean NOT NULL DEFAULT false,
    step_buy boolean NOT NULL DEFAULT false,
    step_stake boolean NOT NULL DEFAULT false,
    step_fund boolean NOT NULL DEFAULT false,
    step_tweet boolean NOT NULL DEFAULT false,
    step_poll boolean NOT NULL DEFAULT false,

    -- Feedback
    feedback_status text DEFAULT 'pending' CHECK (feedback_status IN ('pending', 'actioned', 'dismissed')),

    -- Meta
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_factory_created ON app_factory_pipelines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_creator ON app_factory_pipelines(created_by);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_factory_pipeline_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_factory_pipeline_updated ON app_factory_pipelines;
CREATE TRIGGER trg_factory_pipeline_updated
    BEFORE UPDATE ON app_factory_pipelines
    FOR EACH ROW EXECUTE FUNCTION update_factory_pipeline_updated_at();

-- RLS
ALTER TABLE app_factory_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON app_factory_pipelines
    FOR ALL USING (true) WITH CHECK (true);
