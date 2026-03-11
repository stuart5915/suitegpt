-- Track which X account each tweet was posted from
ALTER TABLE inclawbator_agent_posts
    ADD COLUMN IF NOT EXISTS posted_via text DEFAULT '@inclawbator';

-- Update posts_per_day constraint to 1-3 (was 1-12)
ALTER TABLE inclawbator_projects DROP CONSTRAINT IF EXISTS chk_agent_posts_per_day;
ALTER TABLE inclawbator_projects
    ADD CONSTRAINT chk_agent_posts_per_day CHECK (agent_posts_per_day BETWEEN 1 AND 3);

-- Ensure any existing values > 3 get capped
UPDATE inclawbator_projects SET agent_posts_per_day = 3 WHERE agent_posts_per_day > 3;
