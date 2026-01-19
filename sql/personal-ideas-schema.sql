-- Personal Ideas Capture System
-- For Telegram bot idea capture with AI categorization

-- Create the personal_ideas table
CREATE TABLE IF NOT EXISTS personal_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_input TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'inbox',
    dismiss_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add constraint for valid statuses
ALTER TABLE personal_ideas
ADD CONSTRAINT personal_ideas_status_check
CHECK (status IN ('inbox', 'pushed', 'artstu', 'dismissed', 'implemented'));

-- Add constraint for valid categories
ALTER TABLE personal_ideas
ADD CONSTRAINT personal_ideas_category_check
CHECK (category IN (
    'action_item',
    'suite_feature',
    'suite_business',
    'app_idea',
    'article',
    'personal',
    'brainstorm',
    'question'
));

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_personal_ideas_status ON personal_ideas(status);
CREATE INDEX IF NOT EXISTS idx_personal_ideas_category ON personal_ideas(category);
CREATE INDEX IF NOT EXISTS idx_personal_ideas_created_at ON personal_ideas(created_at DESC);

-- Enable RLS
ALTER TABLE personal_ideas ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (single user system for now)
CREATE POLICY "Allow all access to personal_ideas" ON personal_ideas
    FOR ALL USING (true) WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_personal_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_personal_ideas_updated_at ON personal_ideas;
CREATE TRIGGER trigger_update_personal_ideas_updated_at
    BEFORE UPDATE ON personal_ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_personal_ideas_updated_at();
