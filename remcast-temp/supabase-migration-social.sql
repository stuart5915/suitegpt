-- REMcast Social Layer Migration
-- Run this in Supabase SQL Editor

-- ============================================
-- STEP 1: Add social counts to dreams table
-- ============================================
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE dreams ADD COLUMN IF NOT EXISTS shares_count INTEGER DEFAULT 0;

-- ============================================
-- STEP 2: Dream Likes Table
-- ============================================
CREATE TABLE IF NOT EXISTS dream_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(dream_id, user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_dream_likes_dream ON dream_likes(dream_id);
CREATE INDEX IF NOT EXISTS idx_dream_likes_user ON dream_likes(user_id);

-- RLS
ALTER TABLE dream_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dream likes"
ON dream_likes FOR SELECT USING (true);

CREATE POLICY "Users can like dreams"
ON dream_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
ON dream_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 3: Dream Comments Table
-- ============================================
CREATE TABLE IF NOT EXISTS dream_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id UUID REFERENCES dream_comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dream_comments_dream ON dream_comments(dream_id);
CREATE INDEX IF NOT EXISTS idx_dream_comments_user ON dream_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_dream_comments_parent ON dream_comments(parent_comment_id);

-- RLS
ALTER TABLE dream_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
ON dream_comments FOR SELECT USING (true);

CREATE POLICY "Users can post comments"
ON dream_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON dream_comments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON dream_comments FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: User Follows Table
-- ============================================
CREATE TABLE IF NOT EXISTS user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(follower_id, following_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON user_follows(following_id);

-- RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
ON user_follows FOR SELECT USING (true);

CREATE POLICY "Users can follow"
ON user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON user_follows FOR DELETE USING (auth.uid() = follower_id);

-- ============================================
-- STEP 5: Saved Dreams (Collections)
-- ============================================
CREATE TABLE IF NOT EXISTS saved_dreams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, dream_id)
);

-- RLS
ALTER TABLE saved_dreams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved"
ON saved_dreams FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save dreams"
ON saved_dreams FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave dreams"
ON saved_dreams FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 6: Add user profile fields for social
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dreams_count INTEGER DEFAULT 0;

-- ============================================
-- Comments on columns
-- ============================================
COMMENT ON TABLE dream_likes IS 'Tracks which users liked which dreams';
COMMENT ON TABLE dream_comments IS 'Comments and replies on dreams';
COMMENT ON TABLE user_follows IS 'User follow relationships';
COMMENT ON TABLE saved_dreams IS 'User saved/bookmarked dreams';
