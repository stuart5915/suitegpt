-- Allow agent_replies.project_id to be NULL (for @inclawbate-level replies)
ALTER TABLE agent_replies ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE agent_replies DROP CONSTRAINT IF EXISTS agent_replies_project_id_fkey;
ALTER TABLE agent_replies ADD CONSTRAINT agent_replies_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
-- The FK already allows NULL by default in Postgres — just ensure column is nullable

-- Seed x_relay_state rows for mention and DM responders
INSERT INTO x_relay_state (x_handle, last_tweet_id, last_checked_at)
VALUES
  ('inclawbator_mentions', NULL, now()),
  ('inclawbator_dms', NULL, now())
ON CONFLICT (x_handle) DO NOTHING;
