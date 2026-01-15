-- ======================================================
-- REMCAST COMPLETE DATABASE SETUP (Safe Version)
-- Run this in Supabase SQL Editor
-- ======================================================

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    display_name TEXT,
    username TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    dreams_count INTEGER DEFAULT 0
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, username)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        split_part(NEW.email, '@', 1)
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. DREAMS TABLE (Drop and Recreate)
-- ============================================
DROP TABLE IF EXISTS dream_comments CASCADE;
DROP TABLE IF EXISTS dream_likes CASCADE;
DROP TABLE IF EXISTS dreams CASCADE;

CREATE TABLE dreams (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audio & Transcription
    audio_url TEXT,
    transcript TEXT,
    
    -- AI-Generated Content
    title TEXT,
    scenes JSONB,
    mood TEXT,
    reel_url TEXT,
    thumbnail_url TEXT,
    reel_duration_seconds INTEGER,
    
    -- Processing Status
    processing_status TEXT DEFAULT 'pending',
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    
    -- Video Generation Status
    generation_status TEXT DEFAULT 'pending',
    generation_progress INTEGER DEFAULT 0,
    generation_error TEXT,
    generated_at TIMESTAMPTZ,
    
    -- Social
    is_public BOOLEAN DEFAULT false,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0
);

CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_created_at ON dreams(created_at DESC);
CREATE INDEX idx_dreams_is_public ON dreams(is_public) WHERE is_public = true;
CREATE INDEX idx_dreams_processing ON dreams(processing_status);

ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dreams"
    ON dreams FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public dreams"
    ON dreams FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create own dreams"
    ON dreams FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dreams"
    ON dreams FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own dreams"
    ON dreams FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. USER CREDITS
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    video_credits INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credits" ON user_credits;
CREATE POLICY "Users can view own credits"
    ON user_credits FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own credits" ON user_credits;
CREATE POLICY "Users can update own credits"
    ON user_credits FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create credits for new users
CREATE OR REPLACE FUNCTION handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_credits (user_id, video_credits)
    VALUES (NEW.id, 3)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_credits();

-- ============================================
-- 4. SOCIAL TABLES
-- ============================================

-- Dream Likes
CREATE TABLE dream_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(dream_id, user_id)
);

ALTER TABLE dream_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes"
    ON dream_likes FOR SELECT USING (true);

CREATE POLICY "Users can like dreams"
    ON dream_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
    ON dream_likes FOR DELETE USING (auth.uid() = user_id);

-- Dream Comments
CREATE TABLE dream_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dream_id UUID REFERENCES dreams(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parent_comment_id UUID REFERENCES dream_comments(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dream_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments"
    ON dream_comments FOR SELECT USING (true);

CREATE POLICY "Users can post comments"
    ON dream_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
    ON dream_comments FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. STORAGE BUCKETS
-- ============================================

-- Dream Audio Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dream-audio', 'dream-audio', true, 52428800, 
    ARRAY['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/webm', 'audio/x-m4a'])
ON CONFLICT (id) DO NOTHING;

-- Dream Reels Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dream-reels', 'dream-reels', true, 104857600,
    ARRAY['video/mp4', 'video/webm', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (drop existing first to avoid conflicts)
DROP POLICY IF EXISTS "Users can upload own audio" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own reels" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read reels" ON storage.objects;

CREATE POLICY "Users can upload own audio" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dream-audio' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can read audio" ON storage.objects FOR SELECT
USING (bucket_id = 'dream-audio');

CREATE POLICY "Users can upload own reels" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'dream-reels' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can read reels" ON storage.objects FOR SELECT
USING (bucket_id = 'dream-reels');

-- ============================================
-- DONE! 
-- ============================================
SELECT 'REMcast database setup complete!' as status;
