-- Agent Auto-Reply: track X user ID, last mention seen, and reply log

ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_x_user_id text DEFAULT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_last_mention_id text DEFAULT NULL;

CREATE TABLE IF NOT EXISTS agent_replies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
    mention_tweet_id text NOT NULL,
    mention_text text,
    mention_author text,
    reply_tweet_id text,
    reply_text text NOT NULL,
    status text DEFAULT 'posted' CHECK (status IN ('posted', 'failed', 'skipped')),
    error_message text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_replies_project ON agent_replies(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_replies_mention ON agent_replies(mention_tweet_id);
