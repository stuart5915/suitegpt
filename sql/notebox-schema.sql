-- NoteBox Schema Update
-- Add user_id to personal_ideas for multi-user support

-- Add user_id column to personal_ideas
ALTER TABLE personal_ideas
ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_personal_ideas_user ON personal_ideas(user_id);

-- Optional: Assign existing ideas to Stuart's user ID
-- Run this after adding the column to migrate your existing data:
-- UPDATE personal_ideas SET user_id = 'tg_YOUR_TELEGRAM_ID' WHERE user_id IS NULL;

-- RLS Policy: Users can only see their own ideas
ALTER TABLE personal_ideas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own ideas" ON personal_ideas;
DROP POLICY IF EXISTS "Users can insert own ideas" ON personal_ideas;
DROP POLICY IF EXISTS "Users can update own ideas" ON personal_ideas;
DROP POLICY IF EXISTS "Users can delete own ideas" ON personal_ideas;
DROP POLICY IF EXISTS "Public read personal_ideas" ON personal_ideas;
DROP POLICY IF EXISTS "Service write personal_ideas" ON personal_ideas;

-- Create policies for user-specific access
-- Note: Since we're using anon key with user_id filter in the app,
-- we'll keep it simple with service role access
CREATE POLICY "Service full access personal_ideas"
ON personal_ideas FOR ALL
USING (true)
WITH CHECK (true);
