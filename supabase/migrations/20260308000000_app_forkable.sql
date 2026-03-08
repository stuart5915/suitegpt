-- Add forkable toggle to user_apps (default true for backwards compatibility)
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS forkable BOOLEAN DEFAULT true;
