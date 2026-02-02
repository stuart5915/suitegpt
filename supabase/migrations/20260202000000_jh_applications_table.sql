-- Pipeline Tracker: move from localStorage to Supabase
CREATE TABLE IF NOT EXISTS jh_applications (
  id text PRIMARY KEY,
  user_id uuid NOT NULL,
  company text NOT NULL,
  role text NOT NULL,
  link text DEFAULT '',
  stage text NOT NULL DEFAULT 'applied',
  date text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_jh_applications_user_id ON jh_applications(user_id);

ALTER TABLE jh_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own applications"
  ON jh_applications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications"
  ON jh_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications"
  ON jh_applications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications"
  ON jh_applications FOR DELETE USING (auth.uid() = user_id);
