-- Exercise History Table
-- Tracks weight and reps for each set performed

CREATE TABLE IF NOT EXISTS exercise_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    weight DECIMAL,
    weight_unit TEXT DEFAULT 'lbs',
    reps INTEGER,
    set_number INTEGER,
    plan_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookups by user and exercise
CREATE INDEX IF NOT EXISTS idx_exercise_history_user_exercise 
    ON exercise_history(user_id, exercise_name);

-- Index for chronological queries
CREATE INDEX IF NOT EXISTS idx_exercise_history_created 
    ON exercise_history(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE exercise_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own exercise history"
    ON exercise_history
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own exercise history"
    ON exercise_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own exercise history"
    ON exercise_history
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own exercise history"
    ON exercise_history
    FOR DELETE
    USING (auth.uid() = user_id);
