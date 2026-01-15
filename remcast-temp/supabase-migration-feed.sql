-- Public Reflection Feed Migration
-- Run this in your Supabase SQL Editor

-- 1. Create public_reflections table
CREATE TABLE IF NOT EXISTS public_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verse_reference TEXT NOT NULL,
    verse_text TEXT NOT NULL,
    reflection TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for feed queries (newest first)
CREATE INDEX IF NOT EXISTS idx_public_reflections_created ON public_reflections(created_at DESC);

-- 2. Create reflection_likes table
CREATE TABLE IF NOT EXISTS reflection_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reflection_id UUID NOT NULL REFERENCES public_reflections(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, reflection_id)
);

-- Index for checking if user liked
CREATE INDEX IF NOT EXISTS idx_reflection_likes_user ON reflection_likes(user_id, reflection_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflection_likes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for public_reflections
-- Anyone can read public reflections (this is what makes them public!)
CREATE POLICY "Anyone can read public reflections" 
    ON public_reflections FOR SELECT 
    USING (true);

-- Users can only insert their own reflections
CREATE POLICY "Users can insert own reflections" 
    ON public_reflections FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own reflections
CREATE POLICY "Users can update own reflections" 
    ON public_reflections FOR UPDATE 
    USING (auth.uid() = user_id);

-- Users can delete their own reflections
CREATE POLICY "Users can delete own reflections" 
    ON public_reflections FOR DELETE 
    USING (auth.uid() = user_id);

-- 5. RLS Policies for reflection_likes
-- Anyone can see like counts (for display)
CREATE POLICY "Anyone can read likes" 
    ON reflection_likes FOR SELECT 
    USING (true);

-- Users can like/unlike
CREATE POLICY "Users can insert own likes" 
    ON reflection_likes FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes" 
    ON reflection_likes FOR DELETE 
    USING (auth.uid() = user_id);

-- 6. Function to update likes_count when likes change
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public_reflections 
        SET likes_count = likes_count + 1 
        WHERE id = NEW.reflection_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public_reflections 
        SET likes_count = likes_count - 1 
        WHERE id = OLD.reflection_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Triggers to auto-update like counts
DROP TRIGGER IF EXISTS on_like_insert ON reflection_likes;
CREATE TRIGGER on_like_insert
    AFTER INSERT ON reflection_likes
    FOR EACH ROW EXECUTE FUNCTION update_likes_count();

DROP TRIGGER IF EXISTS on_like_delete ON reflection_likes;
CREATE TRIGGER on_like_delete
    AFTER DELETE ON reflection_likes
    FOR EACH ROW EXECUTE FUNCTION update_likes_count();
-- Storage Buckets for Profile
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Avatars)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Anyone can upload an avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Anyone can update an avatar" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'avatars');

-- Storage Policies (Banners)
CREATE POLICY "Banner images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Anyone can upload a banner" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'banners');
CREATE POLICY "Anyone can update a banner" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'banners');
