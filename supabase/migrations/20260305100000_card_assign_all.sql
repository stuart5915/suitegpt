-- Add assign_all flag for cards assigned to everyone
ALTER TABLE team_cards ADD COLUMN assign_all boolean NOT NULL DEFAULT false;
