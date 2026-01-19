-- Claude Tasks Queue
-- For sending prompts to local Claude CLI and getting responses

CREATE TABLE IF NOT EXISTS claude_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idea_id UUID REFERENCES personal_ideas(id),
    prompt TEXT NOT NULL,
    response TEXT,
    status TEXT DEFAULT 'pending',
    target TEXT NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Status constraint
ALTER TABLE claude_tasks
ADD CONSTRAINT claude_tasks_status_check
CHECK (status IN ('pending', 'processing', 'completed', 'error', 'needs_input'));

-- Target constraint (suite or artstu)
ALTER TABLE claude_tasks
ADD CONSTRAINT claude_tasks_target_check
CHECK (target IN ('suite', 'artstu'));

-- Index for polling pending tasks
CREATE INDEX IF NOT EXISTS idx_claude_tasks_status ON claude_tasks(status);
CREATE INDEX IF NOT EXISTS idx_claude_tasks_created_at ON claude_tasks(created_at DESC);

-- Enable RLS
ALTER TABLE claude_tasks ENABLE ROW LEVEL SECURITY;

-- Allow public access (single user system)
CREATE POLICY "Allow all access to claude_tasks" ON claude_tasks
    FOR ALL USING (true) WITH CHECK (true);
