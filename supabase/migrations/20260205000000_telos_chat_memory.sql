-- Telos Chat: memory + briefs + feedback

CREATE TABLE IF NOT EXISTS telos_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  mission text,
  monthly_focus text,
  constraints text,
  priorities text,
  tone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telos_memory_user_id ON telos_memory(user_id);

CREATE TABLE IF NOT EXISTS telos_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  input_context jsonb,
  output jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telos_briefs_user_id ON telos_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_telos_briefs_created_at ON telos_briefs(created_at DESC);

CREATE TABLE IF NOT EXISTS telos_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  brief_id uuid,
  suggestion_id text,
  rating text NOT NULL CHECK (rating IN ('helpful', 'not_helpful')),
  reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telos_feedback_user_id ON telos_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_telos_feedback_brief_id ON telos_feedback(brief_id);
CREATE INDEX IF NOT EXISTS idx_telos_feedback_created_at ON telos_feedback(created_at DESC);

ALTER TABLE telos_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE telos_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE telos_feedback ENABLE ROW LEVEL SECURITY;

-- Public policies (client filters by user_id in queries)
CREATE POLICY "Public read telos_memory"
  ON telos_memory FOR SELECT USING (true);
CREATE POLICY "Public write telos_memory"
  ON telos_memory FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update telos_memory"
  ON telos_memory FOR UPDATE USING (true);

CREATE POLICY "Public read telos_briefs"
  ON telos_briefs FOR SELECT USING (true);
CREATE POLICY "Public write telos_briefs"
  ON telos_briefs FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read telos_feedback"
  ON telos_feedback FOR SELECT USING (true);
CREATE POLICY "Public write telos_feedback"
  ON telos_feedback FOR INSERT WITH CHECK (true);
