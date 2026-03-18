-- Add agent deployment columns to app_factory_pipelines

ALTER TABLE app_factory_pipelines
    ADD COLUMN IF NOT EXISTS step_agents boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS agents_deployed integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS skill_endpoints jsonb;
