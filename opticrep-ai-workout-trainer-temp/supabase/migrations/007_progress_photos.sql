-- Progress Photos Table
CREATE TABLE IF NOT EXISTS progress_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    pose_type TEXT, -- 'front', 'side', 'back'
    notes TEXT,
    weight_at_time DECIMAL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_progress_photos_user 
    ON progress_photos(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Users can insert their own progress photos" ON progress_photos;
DROP POLICY IF EXISTS "Users can delete their own progress photos" ON progress_photos;

CREATE POLICY "Users can view their own progress photos"
    ON progress_photos FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress photos"
    ON progress_photos FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress photos"
    ON progress_photos FOR DELETE USING (auth.uid() = user_id);
