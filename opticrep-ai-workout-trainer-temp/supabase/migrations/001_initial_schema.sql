-- OpticRep AI Workout Trainer - Initial Schema
-- Migration: 001_initial_schema.sql

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- 1. PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{
        "units": "imperial",
        "audioFeedback": true,
        "debugOverlay": false
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. WORKOUT PLANS (1-7 day schedules)
-- ============================================
CREATE TABLE public.workout_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    frequency_days INTEGER NOT NULL CHECK (frequency_days >= 1 AND frequency_days <= 7),
    -- Schedule as JSONB: { "1": ["chest", "triceps"], "2": ["back", "biceps"], ... }
    schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_plans_user ON public.workout_plans(user_id);
CREATE INDEX idx_workout_plans_active ON public.workout_plans(user_id, is_active) WHERE is_active = true;

-- ============================================
-- 3. WORKOUT SESSIONS (individual workouts)
-- ============================================
CREATE TABLE public.workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.workout_plans(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    -- Summary stats computed post-workout
    total_reps INTEGER DEFAULT 0,
    total_sets INTEGER DEFAULT 0,
    total_volume_lbs NUMERIC(10,2) DEFAULT 0,
    -- AI-generated summary
    ai_summary TEXT,
    ai_performance_score INTEGER CHECK (ai_performance_score >= 1 AND ai_performance_score <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON public.workout_sessions(user_id);
CREATE INDEX idx_sessions_date ON public.workout_sessions(user_id, started_at DESC);

-- ============================================
-- 4. EXERCISES (library of exercises)
-- ============================================
CREATE TABLE public.exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'compound', 'isolation', 'cardio'
    muscle_groups TEXT[] NOT NULL, -- ['chest', 'triceps']
    equipment TEXT, -- 'barbell', 'dumbbell', 'cable', 'bodyweight'
    -- MediaPipe tracking config
    tracked_joints TEXT[], -- ['left_elbow', 'right_elbow']
    rep_detection_config JSONB, -- { "angleThresholdUp": 160, "angleThresholdDown": 45 }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. EXERCISE SETS (sets within a session)
-- ============================================
CREATE TABLE public.exercise_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
    set_number INTEGER NOT NULL,
    weight_lbs NUMERIC(6,2),
    target_reps INTEGER,
    completed_reps INTEGER DEFAULT 0,
    -- Tracking method: 'auto' (MediaPipe) or 'manual'
    tracking_method TEXT DEFAULT 'auto' CHECK (tracking_method IN ('auto', 'manual')),
    -- Form quality assessed by AI
    form_quality TEXT CHECK (form_quality IN ('excellent', 'good', 'fair', 'poor')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sets_session ON public.exercise_sets(session_id);

-- ============================================
-- 6. REP DATA (per-rep vision tracking)
-- ============================================
CREATE TABLE public.rep_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    set_id UUID NOT NULL REFERENCES public.exercise_sets(id) ON DELETE CASCADE,
    rep_number INTEGER NOT NULL,
    -- Joint angle data from MediaPipe
    joint_angles JSONB NOT NULL, -- { "leftElbow": [45, 90, 160, 90, 45], "rightElbow": [...] }
    -- Timing
    tempo_seconds NUMERIC(4,2), -- Total rep duration
    eccentric_seconds NUMERIC(4,2), -- Lowering phase
    concentric_seconds NUMERIC(4,2), -- Lifting phase
    -- Quality assessment
    form_quality TEXT CHECK (form_quality IN ('good', 'fair', 'poor')),
    form_notes TEXT, -- "Left elbow flared out"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rep_data_set ON public.rep_data(set_id);

-- ============================================
-- 7. AUDIO REFLECTIONS (voice recordings)
-- ============================================
CREATE TABLE public.audio_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL, -- Supabase Storage path
    duration_seconds INTEGER,
    -- Gemini transcription (optional, for search)
    transcript TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audio_session ON public.audio_reflections(session_id);

-- ============================================
-- 8. JOURNAL ENTRIES (daily logs)
-- ============================================
CREATE TABLE public.journal_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    -- Recovery metrics
    sleep_hours NUMERIC(3,1),
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    muscle_soreness INTEGER CHECK (muscle_soreness >= 1 AND muscle_soreness <= 10),
    -- Notes
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- One entry per day per user
    UNIQUE(user_id, entry_date)
);

CREATE INDEX idx_journal_user_date ON public.journal_entries(user_id, entry_date DESC);

-- ============================================
-- 9. DIET LOGS (nutrition tracking)
-- ============================================
CREATE TABLE public.diet_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout')),
    description TEXT,
    -- Macros (optional)
    calories INTEGER,
    protein_g NUMERIC(6,1),
    carbs_g NUMERIC(6,1),
    fat_g NUMERIC(6,1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diet_user_date ON public.diet_logs(user_id, log_date DESC);

-- ============================================
-- 10. INJURY HISTORY (for AI memory)
-- ============================================
CREATE TABLE public.injury_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body_part TEXT NOT NULL, -- 'left_shoulder', 'lower_back'
    injury_type TEXT, -- 'strain', 'sprain', 'chronic'
    severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe')),
    description TEXT,
    occurred_at DATE,
    resolved_at DATE,
    is_active BOOLEAN DEFAULT true,
    -- Exercises to avoid
    avoid_exercises UUID[], -- References to exercises table
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_injuries_user ON public.injury_history(user_id);
CREATE INDEX idx_injuries_active ON public.injury_history(user_id, is_active) WHERE is_active = true;

-- ============================================
-- 11. CHAT MESSAGES (Pro-Coach history)
-- ============================================
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    -- Metadata for context
    metadata JSONB, -- { "referencedSession": "uuid", "referencedInjury": "uuid" }
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_user ON public.chat_messages(user_id, created_at DESC);

-- ============================================
-- 12. MESSAGE EMBEDDINGS (semantic search)
-- ============================================
CREATE TABLE public.message_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    -- 768-dimensional embedding from Gemini
    embedding vector(768) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for similarity search
CREATE INDEX idx_embeddings_vector ON public.message_embeddings 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to search similar messages
CREATE OR REPLACE FUNCTION match_messages(
    query_embedding vector(768),
    match_threshold float,
    match_count int
)
RETURNS TABLE (
    id uuid,
    message_id uuid,
    content text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        me.id,
        me.message_id,
        cm.content,
        1 - (me.embedding <=> query_embedding) as similarity
    FROM public.message_embeddings me
    JOIN public.chat_messages cm ON cm.id = me.message_id
    WHERE 1 - (me.embedding <=> query_embedding) > match_threshold
    ORDER BY me.embedding <=> query_embedding
    LIMIT match_count;
$$;

-- Function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (new.id, new.email);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- SEED DATA: Exercise Library
-- ============================================
INSERT INTO public.exercises (name, category, muscle_groups, equipment, tracked_joints, rep_detection_config) VALUES
-- Chest
('Barbell Bench Press', 'compound', ARRAY['chest', 'triceps', 'shoulders'], 'barbell', 
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 160, "angleThresholdDown": 70}'::jsonb),
('Dumbbell Incline Press', 'compound', ARRAY['chest', 'triceps', 'shoulders'], 'dumbbell',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 160, "angleThresholdDown": 70}'::jsonb),
('Cable Fly', 'isolation', ARRAY['chest'], 'cable',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 150, "angleThresholdDown": 30}'::jsonb),

-- Back
('Barbell Row', 'compound', ARRAY['back', 'biceps'], 'barbell',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 160, "angleThresholdDown": 45}'::jsonb),
('Lat Pulldown', 'compound', ARRAY['back', 'biceps'], 'cable',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 170, "angleThresholdDown": 50}'::jsonb),
('Seated Cable Row', 'compound', ARRAY['back', 'biceps'], 'cable',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 170, "angleThresholdDown": 60}'::jsonb),

-- Shoulders
('Overhead Press', 'compound', ARRAY['shoulders', 'triceps'], 'barbell',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 175, "angleThresholdDown": 90}'::jsonb),
('Lateral Raise', 'isolation', ARRAY['shoulders'], 'dumbbell',
 ARRAY['left_shoulder', 'right_shoulder'], '{"angleThresholdUp": 90, "angleThresholdDown": 15}'::jsonb),

-- Arms
('Barbell Curl', 'isolation', ARRAY['biceps'], 'barbell',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 160, "angleThresholdDown": 35}'::jsonb),
('Tricep Pushdown', 'isolation', ARRAY['triceps'], 'cable',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 170, "angleThresholdDown": 50}'::jsonb),
('Hammer Curl', 'isolation', ARRAY['biceps', 'forearms'], 'dumbbell',
 ARRAY['left_elbow', 'right_elbow'], '{"angleThresholdUp": 160, "angleThresholdDown": 35}'::jsonb),

-- Legs
('Barbell Squat', 'compound', ARRAY['quadriceps', 'glutes', 'hamstrings'], 'barbell',
 ARRAY['left_knee', 'right_knee'], '{"angleThresholdUp": 170, "angleThresholdDown": 70}'::jsonb),
('Romanian Deadlift', 'compound', ARRAY['hamstrings', 'glutes', 'lower_back'], 'barbell',
 ARRAY['left_hip', 'right_hip'], '{"angleThresholdUp": 175, "angleThresholdDown": 100}'::jsonb),
('Leg Press', 'compound', ARRAY['quadriceps', 'glutes'], 'machine',
 ARRAY['left_knee', 'right_knee'], '{"angleThresholdUp": 170, "angleThresholdDown": 60}'::jsonb),
('Leg Curl', 'isolation', ARRAY['hamstrings'], 'machine',
 ARRAY['left_knee', 'right_knee'], '{"angleThresholdUp": 170, "angleThresholdDown": 45}'::jsonb);
