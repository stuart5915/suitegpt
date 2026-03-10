-- Add marketing plan persistence to both project tables
ALTER TABLE inclawbator_projects ADD COLUMN IF NOT EXISTS marketing_plan text;
ALTER TABLE inclawbator_projects ADD COLUMN IF NOT EXISTS marketing_plan_generated_at timestamptz;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS marketing_plan text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS marketing_plan_generated_at timestamptz;
