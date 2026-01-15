-- OpticRep AI Workout Trainer - Saved Workout Templates
-- Migration: 003_saved_workout_templates.sql
-- 
-- This table stores coach-imported workout templates with full exercise/set data

-- ============================================
-- SAVED WORKOUT TEMPLATES (from AI import)
-- ============================================
CREATE TABLE public.saved_workout_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Full workout data stored as JSONB for flexibility
    -- Structure: WorkoutDay[] with exercises, sets, modifiers, notes
    days JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX idx_saved_templates_user ON public.saved_workout_templates(user_id);
CREATE INDEX idx_saved_templates_updated ON public.saved_workout_templates(user_id, updated_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.saved_workout_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own templates
CREATE POLICY "Users can view own templates"
    ON public.saved_workout_templates
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own templates
CREATE POLICY "Users can insert own templates"
    ON public.saved_workout_templates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own templates
CREATE POLICY "Users can update own templates"
    ON public.saved_workout_templates
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own templates
CREATE POLICY "Users can delete own templates"
    ON public.saved_workout_templates
    FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_saved_templates_updated_at
    BEFORE UPDATE ON public.saved_workout_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
