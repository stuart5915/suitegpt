-- Seed columns for S4H Church and Marketing boards
INSERT INTO team_columns (title, position, board_id) VALUES
  ('Backlog',     0, 'ff349bec-2614-4be2-96d7-c5af4d7e1c53'),
  ('In Progress', 1, 'ff349bec-2614-4be2-96d7-c5af4d7e1c53'),
  ('Review',      2, 'ff349bec-2614-4be2-96d7-c5af4d7e1c53'),
  ('Done',        3, 'ff349bec-2614-4be2-96d7-c5af4d7e1c53'),
  ('Backlog',     0, '2ba20493-7794-4e3d-8b5e-fd37651631fb'),
  ('In Progress', 1, '2ba20493-7794-4e3d-8b5e-fd37651631fb'),
  ('Review',      2, '2ba20493-7794-4e3d-8b5e-fd37651631fb'),
  ('Done',        3, '2ba20493-7794-4e3d-8b5e-fd37651631fb');

INSERT INTO team_channels (title, position, board_id) VALUES
  ('General', 0, 'ff349bec-2614-4be2-96d7-c5af4d7e1c53'),
  ('General', 0, '2ba20493-7794-4e3d-8b5e-fd37651631fb');

-- Calendar events table
CREATE TABLE IF NOT EXISTS team_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES team_boards(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time time,
  category text NOT NULL DEFAULT 'content',
  status text NOT NULL DEFAULT 'scheduled',
  assigned_to uuid REFERENCES team_members(id),
  created_by uuid REFERENCES team_members(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cal_events_board_date ON team_calendar_events (board_id, event_date);
