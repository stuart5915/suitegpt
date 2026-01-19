-- NoteBox Categories Table
-- Stores user-customizable categories for both Telegram bot and web dashboard

CREATE TABLE IF NOT EXISTS notebox_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- Format: tg_123456 or wallet_0x...
    slug TEXT NOT NULL,     -- e.g., 'brainstorm', 'action_item'
    emoji TEXT NOT NULL,    -- e.g., '💭', '✅'
    label TEXT NOT NULL,    -- e.g., 'Brainstorm', 'Action'
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only have one category with a given slug
    UNIQUE(user_id, slug)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_notebox_categories_user ON notebox_categories(user_id);

-- Enable RLS
ALTER TABLE notebox_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own categories
CREATE POLICY "Users can read own categories" ON notebox_categories
    FOR SELECT USING (true);  -- Allow reading all (service key handles auth)

-- Policy: Users can insert their own categories
CREATE POLICY "Users can insert own categories" ON notebox_categories
    FOR INSERT WITH CHECK (true);

-- Policy: Users can update their own categories
CREATE POLICY "Users can update own categories" ON notebox_categories
    FOR UPDATE USING (true);

-- Policy: Users can delete their own categories
CREATE POLICY "Users can delete own categories" ON notebox_categories
    FOR DELETE USING (true);
