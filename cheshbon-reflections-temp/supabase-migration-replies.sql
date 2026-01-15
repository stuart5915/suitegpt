-- Reflection Replies Table
CREATE TABLE reflection_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reflection_id UUID NOT NULL REFERENCES public_reflections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reply_text TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    parent_reply_id UUID REFERENCES reflection_replies(id) ON DELETE CASCADE -- Optional: For nested replies later
);

-- Index for querying replies by reflection
CREATE INDEX idx_reflection_replies_reflection_id ON reflection_replies(reflection_id);

-- RLS
ALTER TABLE reflection_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read replies" ON reflection_replies FOR SELECT USING (true);
CREATE POLICY "Users can insert own replies" ON reflection_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own replies" ON reflection_replies FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own replies" ON reflection_replies FOR UPDATE USING (auth.uid() = user_id);

-- View to get reply count efficiently (optional, but good for performance)
-- We'll just select count(*) for now in the service layer or join
