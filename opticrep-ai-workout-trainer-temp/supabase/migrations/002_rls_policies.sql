-- OpticRep AI Workout Trainer - Row Level Security Policies
-- Migration: 002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diet_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.injury_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_embeddings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES
-- ============================================
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ============================================
-- WORKOUT PLANS
-- ============================================
CREATE POLICY "Users can view own plans"
    ON public.workout_plans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plans"
    ON public.workout_plans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
    ON public.workout_plans FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plans"
    ON public.workout_plans FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- WORKOUT SESSIONS
-- ============================================
CREATE POLICY "Users can view own sessions"
    ON public.workout_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions"
    ON public.workout_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
    ON public.workout_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
    ON public.workout_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- EXERCISES (public read, admin write)
-- ============================================
CREATE POLICY "Anyone can view exercises"
    ON public.exercises FOR SELECT
    USING (true);

-- ============================================
-- EXERCISE SETS
-- ============================================
CREATE POLICY "Users can view own sets"
    ON public.exercise_sets FOR SELECT
    USING (
        auth.uid() = (
            SELECT user_id FROM public.workout_sessions 
            WHERE id = exercise_sets.session_id
        )
    );

CREATE POLICY "Users can create own sets"
    ON public.exercise_sets FOR INSERT
    WITH CHECK (
        auth.uid() = (
            SELECT user_id FROM public.workout_sessions 
            WHERE id = exercise_sets.session_id
        )
    );

CREATE POLICY "Users can update own sets"
    ON public.exercise_sets FOR UPDATE
    USING (
        auth.uid() = (
            SELECT user_id FROM public.workout_sessions 
            WHERE id = exercise_sets.session_id
        )
    );

CREATE POLICY "Users can delete own sets"
    ON public.exercise_sets FOR DELETE
    USING (
        auth.uid() = (
            SELECT user_id FROM public.workout_sessions 
            WHERE id = exercise_sets.session_id
        )
    );

-- ============================================
-- REP DATA
-- ============================================
CREATE POLICY "Users can view own rep data"
    ON public.rep_data FOR SELECT
    USING (
        auth.uid() = (
            SELECT ws.user_id 
            FROM public.workout_sessions ws
            JOIN public.exercise_sets es ON es.session_id = ws.id
            WHERE es.id = rep_data.set_id
        )
    );

CREATE POLICY "Users can create own rep data"
    ON public.rep_data FOR INSERT
    WITH CHECK (
        auth.uid() = (
            SELECT ws.user_id 
            FROM public.workout_sessions ws
            JOIN public.exercise_sets es ON es.session_id = ws.id
            WHERE es.id = rep_data.set_id
        )
    );

CREATE POLICY "Users can update own rep data"
    ON public.rep_data FOR UPDATE
    USING (
        auth.uid() = (
            SELECT ws.user_id 
            FROM public.workout_sessions ws
            JOIN public.exercise_sets es ON es.session_id = ws.id
            WHERE es.id = rep_data.set_id
        )
    );

-- ============================================
-- AUDIO REFLECTIONS
-- ============================================
CREATE POLICY "Users can view own audio"
    ON public.audio_reflections FOR SELECT
    USING (
        auth.uid() = (
            SELECT user_id FROM public.workout_sessions 
            WHERE id = audio_reflections.session_id
        )
    );

CREATE POLICY "Users can create own audio"
    ON public.audio_reflections FOR INSERT
    WITH CHECK (
        auth.uid() = (
            SELECT user_id FROM public.workout_sessions 
            WHERE id = audio_reflections.session_id
        )
    );

-- ============================================
-- JOURNAL ENTRIES
-- ============================================
CREATE POLICY "Users can view own journal"
    ON public.journal_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own journal"
    ON public.journal_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own journal"
    ON public.journal_entries FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own journal"
    ON public.journal_entries FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- DIET LOGS
-- ============================================
CREATE POLICY "Users can view own diet logs"
    ON public.diet_logs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own diet logs"
    ON public.diet_logs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own diet logs"
    ON public.diet_logs FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own diet logs"
    ON public.diet_logs FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- INJURY HISTORY
-- ============================================
CREATE POLICY "Users can view own injuries"
    ON public.injury_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own injuries"
    ON public.injury_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own injuries"
    ON public.injury_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own injuries"
    ON public.injury_history FOR DELETE
    USING (auth.uid() = user_id);

-- ============================================
-- CHAT MESSAGES
-- ============================================
CREATE POLICY "Users can view own messages"
    ON public.chat_messages FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own messages"
    ON public.chat_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- ============================================
-- MESSAGE EMBEDDINGS
-- ============================================
CREATE POLICY "Users can view own embeddings"
    ON public.message_embeddings FOR SELECT
    USING (
        auth.uid() = (
            SELECT user_id FROM public.chat_messages 
            WHERE id = message_embeddings.message_id
        )
    );

CREATE POLICY "Users can create own embeddings"
    ON public.message_embeddings FOR INSERT
    WITH CHECK (
        auth.uid() = (
            SELECT user_id FROM public.chat_messages 
            WHERE id = message_embeddings.message_id
        )
    );

-- ============================================
-- STORAGE BUCKET POLICIES
-- ============================================
-- Note: Run these in Supabase SQL Editor after creating the bucket

-- Create audio_reflections bucket (run manually in Supabase Dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio_reflections', 'audio_reflections', false);

-- Policy for audio_reflections bucket:
-- CREATE POLICY "Users can upload own audio"
--     ON storage.objects FOR INSERT
--     WITH CHECK (
--         bucket_id = 'audio_reflections' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );

-- CREATE POLICY "Users can view own audio"
--     ON storage.objects FOR SELECT
--     USING (
--         bucket_id = 'audio_reflections' AND
--         auth.uid()::text = (storage.foldername(name))[1]
--     );
