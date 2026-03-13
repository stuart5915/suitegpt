-- Allow auto-generated schedule slots without a specific project
-- These are ecosystem-level @inclawbator posts (app spotlights, stats, CTAs)

ALTER TABLE agent_schedule ALTER COLUMN project_id DROP NOT NULL;

-- Add tweet_options column if not exists (for pillar metadata)
DO $$ BEGIN
    ALTER TABLE agent_schedule ADD COLUMN tweet_options jsonb DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add paid_amount column if not exists
DO $$ BEGIN
    ALTER TABLE agent_schedule ADD COLUMN paid_amount integer DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
