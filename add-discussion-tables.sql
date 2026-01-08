-- SUITE Discussion Board Tables
-- Run this in your Supabase SQL Editor

-- Feature Ideas table
CREATE TABLE IF NOT EXISTS feature_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    author TEXT,
    discord_id TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'planned', 'building', 'shipped')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Votes table (tracks who voted on what)
CREATE TABLE IF NOT EXISTS feature_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id UUID REFERENCES feature_ideas(id) ON DELETE CASCADE,
    discord_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(feature_id, discord_id) -- One vote per user per feature
);

-- Enable Row Level Security
ALTER TABLE feature_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read, authenticated users can insert/update
CREATE POLICY "Anyone can read feature_ideas" ON feature_ideas FOR SELECT USING (true);
CREATE POLICY "Anyone can insert feature_ideas" ON feature_ideas FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update votes" ON feature_ideas FOR UPDATE USING (true);

CREATE POLICY "Anyone can read feature_votes" ON feature_votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert feature_votes" ON feature_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own votes" ON feature_votes FOR DELETE USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_ideas_app ON feature_ideas(app);
CREATE INDEX IF NOT EXISTS idx_feature_ideas_votes ON feature_ideas(votes DESC);
CREATE INDEX IF NOT EXISTS idx_feature_votes_discord ON feature_votes(discord_id);
CREATE INDEX IF NOT EXISTS idx_feature_votes_feature ON feature_votes(feature_id);

-- Seed some initial feature ideas
INSERT INTO feature_ideas (app, title, description, author, discord_id, votes, status) VALUES
('food-vitals', 'Barcode scanning for packaged foods', 'Scan barcodes to instantly get nutritional info instead of taking photos.', 'healthnut_jane', 'seed_user_1', 32, 'building'),
('trueform', 'Video recording for exercise tracking', 'Allow users to record their exercise form and get AI feedback over time.', 'fitness_guru', 'seed_user_2', 47, 'planned'),
('deal-tracker', 'Price drop alerts via push notification', 'Get notified when items on watchlist drop below a certain price.', 'bargain_hunter', 'seed_user_3', 28, 'new'),
('cheshbon', 'Daily verse push notifications', 'Send a daily verse at user-selected time with AI-generated reflection.', 'faithwalker', 'seed_user_4', 21, 'new'),
('suite-platform', 'Dark mode for all apps', 'Add a dark mode toggle that syncs across all SUITE apps.', 'night_owl', 'seed_user_5', 65, 'planned');

-- Grant access
GRANT ALL ON feature_ideas TO anon, authenticated;
GRANT ALL ON feature_votes TO anon, authenticated;
