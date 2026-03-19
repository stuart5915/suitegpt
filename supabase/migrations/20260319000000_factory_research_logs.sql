-- Factory Research Logs — stores research conclusions, picked ideas, and reasoning

CREATE TABLE IF NOT EXISTS factory_research_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conclusions text NOT NULL CHECK (char_length(conclusions) BETWEEN 10 AND 20000),
    picked_idea text,
    pick_reason text,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_logs_created ON factory_research_logs(created_at DESC);

ALTER TABLE factory_research_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON factory_research_logs
    FOR ALL USING (true) WITH CHECK (true);
