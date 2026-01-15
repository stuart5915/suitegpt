-- Workout Sessions Table
CREATE TABLE IF NOT EXISTS workout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID,
    day_name TEXT NOT NULL,
    duration_seconds INTEGER,
    exercises_completed INTEGER,
    total_sets INTEGER,
    total_reps INTEGER,
    total_volume INTEGER,
    exercises_data JSONB,  -- Stores detailed exercise breakdown [{name, sets: [{reps, weight}]}]
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user 
    ON workout_sessions(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own workout sessions" ON workout_sessions;
DROP POLICY IF EXISTS "Users can insert their own workout sessions" ON workout_sessions;
DROP POLICY IF EXISTS "Users can update their own workout sessions" ON workout_sessions;
DROP POLICY IF EXISTS "Users can delete their own workout sessions" ON workout_sessions;

CREATE POLICY "Users can view their own workout sessions"
    ON workout_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workout sessions"
    ON workout_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workout sessions"
    ON workout_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workout sessions"
    ON workout_sessions FOR DELETE USING (auth.uid() = user_id);
