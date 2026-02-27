-- Per-project X OAuth tokens for AI agent posting
ALTER TABLE inclawbator_projects
    ADD COLUMN IF NOT EXISTS x_access_token text,
    ADD COLUMN IF NOT EXISTS x_access_secret text;

-- Temporary storage for OAuth 1.0a request tokens (needed between redirect legs)
CREATE TABLE IF NOT EXISTS inclawbator_x_oauth_temp (
    oauth_token text PRIMARY KEY,
    oauth_token_secret text NOT NULL,
    project_id uuid NOT NULL REFERENCES inclawbator_projects(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);

-- Auto-cleanup old temp rows (older than 10 min)
CREATE INDEX IF NOT EXISTS idx_x_oauth_temp_created ON inclawbator_x_oauth_temp(created_at);
