-- Add moderation column to user_apps
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS moderated boolean DEFAULT false;
