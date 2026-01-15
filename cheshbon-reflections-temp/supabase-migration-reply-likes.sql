-- Migration: Add reply likes table
-- Run this in Supabase SQL Editor

-- Create reply_likes table
CREATE TABLE IF NOT EXISTS reply_likes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reply_id UUID NOT NULL REFERENCES reflection_replies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(reply_id, user_id)
);

-- Add like_count column to replies
ALTER TABLE reflection_replies 
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Add parent_reply_id for nested replies (reply to a reply)
ALTER TABLE reflection_replies 
ADD COLUMN IF NOT EXISTS parent_reply_id UUID REFERENCES reflection_replies(id) ON DELETE CASCADE;

-- RLS Policies
ALTER TABLE reply_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all reply likes" ON reply_likes;
CREATE POLICY "Users can view all reply likes" ON reply_likes
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can like replies" ON reply_likes;
CREATE POLICY "Users can like replies" ON reply_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unlike replies" ON reply_likes;
CREATE POLICY "Users can unlike replies" ON reply_likes
    FOR DELETE USING (auth.uid() = user_id);

-- Function to update like count on reply
CREATE OR REPLACE FUNCTION update_reply_like_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reflection_replies SET like_count = like_count + 1 WHERE id = NEW.reply_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reflection_replies SET like_count = like_count - 1 WHERE id = OLD.reply_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for like count
DROP TRIGGER IF EXISTS trigger_update_reply_like_count ON reply_likes;
CREATE TRIGGER trigger_update_reply_like_count
    AFTER INSERT OR DELETE ON reply_likes
    FOR EACH ROW EXECUTE FUNCTION update_reply_like_count();
