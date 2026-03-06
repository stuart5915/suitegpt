-- Platform settings key-value table for admin toggles
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value) VALUES ('allow_anonymous_publish', 'true')
ON CONFLICT (key) DO NOTHING;
