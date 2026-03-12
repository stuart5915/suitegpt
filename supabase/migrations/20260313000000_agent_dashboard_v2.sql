-- Agent Dashboard v2: schedule times, drafts, structured settings

-- New columns on projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_schedule_times jsonb DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_auto_post boolean DEFAULT true;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_auto_reply boolean DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_tone text DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_topics jsonb DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_catchphrase text DEFAULT NULL;

-- Draft posts table
CREATE TABLE IF NOT EXISTS agent_draft_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    tweet_text text NOT NULL,
    content_angle text,
    scheduled_for timestamptz,
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'edited', 'rejected', 'posted', 'expired')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_drafts_project ON agent_draft_posts(project_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_drafts_scheduled ON agent_draft_posts(scheduled_for, status);
