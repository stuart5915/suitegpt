-- OpticRep AI Workout Trainer - Coach Hub Tables
-- Migration: 004_coach_hub.sql

-- ============================================
-- COACH MEMORIES (conversation history + logs)
-- ============================================
CREATE TABLE public.coach_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('user_message', 'coach_message', 'diet_log', 'activity_log', 'wellness_log', 'supplement_log')),
    content TEXT NOT NULL,
    parsed_data JSONB,  -- AI-extracted structured data
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coach_memories_user ON public.coach_memories(user_id);
CREATE INDEX idx_coach_memories_timestamp ON public.coach_memories(user_id, timestamp DESC);

-- RLS
ALTER TABLE public.coach_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories"
    ON public.coach_memories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
    ON public.coach_memories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
    ON public.coach_memories FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- USER SUPPLEMENTS
-- ============================================
CREATE TABLE public.user_supplements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    timing TEXT,          -- e.g., "Morning", "Pre-workout", "Post-workout"
    frequency TEXT,       -- e.g., "Daily", "Training days only"
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supplements_user ON public.user_supplements(user_id);

-- RLS
ALTER TABLE public.user_supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own supplements"
    ON public.user_supplements FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own supplements"
    ON public.user_supplements FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own supplements"
    ON public.user_supplements FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own supplements"
    ON public.user_supplements FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- USER DIET PLANS
-- ============================================
CREATE TABLE public.user_diet_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    calories INTEGER,
    protein_grams INTEGER,
    carb_grams INTEGER,
    fat_grams INTEGER,
    meals JSONB DEFAULT '[]'::jsonb,  -- Array of meal objects
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diet_plans_user ON public.user_diet_plans(user_id);

-- RLS
ALTER TABLE public.user_diet_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diet plans"
    ON public.user_diet_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own diet plans"
    ON public.user_diet_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diet plans"
    ON public.user_diet_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diet plans"
    ON public.user_diet_plans FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- USER PROGRESS PHOTOS
-- ============================================
CREATE TABLE public.progress_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    weight DECIMAL(5,2),       -- in lbs or kg
    body_fat_percent DECIMAL(4,1),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_photos_user ON public.progress_photos(user_id);
CREATE INDEX idx_progress_photos_date ON public.progress_photos(user_id, date DESC);

-- RLS
ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own photos"
    ON public.progress_photos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own photos"
    ON public.progress_photos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own photos"
    ON public.progress_photos FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- ADD GOALS TO PROFILES
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_goal TEXT CHECK (primary_goal IN ('build_muscle', 'lose_fat', 'maintain', 'strength', 'endurance', 'general_fitness'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_weight DECIMAL(5,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_workout_target INTEGER DEFAULT 4;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_notes TEXT;
