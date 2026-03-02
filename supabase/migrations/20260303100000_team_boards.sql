-- Multi-board support for team kanban
-- Each board gets its own columns, cards, and chat channels

CREATE TABLE team_boards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    position int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Seed 3 boards
INSERT INTO team_boards (title, slug, position) VALUES
    ('Inclawbate', 'inclawbate', 0),
    ('Marketing Agency', 'marketing', 1),
    ('S4H Church', 's4h-church', 2);

-- Add board_id to columns (nullable first, backfill, then NOT NULL)
ALTER TABLE team_columns ADD COLUMN board_id uuid REFERENCES team_boards(id);
UPDATE team_columns SET board_id = (SELECT id FROM team_boards WHERE slug = 'inclawbate');
ALTER TABLE team_columns ALTER COLUMN board_id SET NOT NULL;

-- Add board_id to cards
ALTER TABLE team_cards ADD COLUMN board_id uuid REFERENCES team_boards(id);
UPDATE team_cards SET board_id = (SELECT id FROM team_boards WHERE slug = 'inclawbate');
ALTER TABLE team_cards ALTER COLUMN board_id SET NOT NULL;

-- Add board_id to channels
ALTER TABLE team_channels ADD COLUMN board_id uuid REFERENCES team_boards(id);
UPDATE team_channels SET board_id = (SELECT id FROM team_boards WHERE slug = 'inclawbate');
ALTER TABLE team_channels ALTER COLUMN board_id SET NOT NULL;
