-- FitCoach Database Schema
-- Personal Training & Fitness Tracking for SUITE ecosystem

-- ================================================
-- TRAINERS TABLE
-- Stores trainer profiles (can also be individual users)
-- ================================================
CREATE TABLE IF NOT EXISTS trainers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    bio TEXT,
    certifications TEXT[], -- Array of certification names
    specialties TEXT[], -- Array of training specialties
    instagram_handle TEXT,
    profile_image_url TEXT,
    is_verified BOOLEAN DEFAULT false,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'premium', 'enterprise')),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_trainers_user_id ON trainers(user_id);
CREATE INDEX idx_trainers_email ON trainers(email);

-- ================================================
-- TRAINER CLIENTS TABLE
-- Stores clients assigned to trainers
-- ================================================
CREATE TABLE IF NOT EXISTS trainer_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional: client may have their own account
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    goals TEXT, -- Free text description of goals
    notes TEXT, -- Trainer's private notes
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'paused', 'archived')),
    start_date DATE DEFAULT CURRENT_DATE,
    program_id UUID, -- Current assigned program
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trainer_clients_trainer ON trainer_clients(trainer_id);
CREATE INDEX idx_trainer_clients_status ON trainer_clients(status);

-- ================================================
-- WORKOUT PROGRAMS TABLE
-- Reusable workout program templates
-- ================================================
CREATE TABLE IF NOT EXISTS workout_programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    duration_weeks INTEGER DEFAULT 8,
    difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'elite')),
    goal TEXT CHECK (goal IN ('strength', 'hypertrophy', 'fat_loss', 'endurance', 'general_fitness', 'sport_specific')),
    days_per_week INTEGER DEFAULT 4,
    is_public BOOLEAN DEFAULT false, -- Can others use this program?
    is_template BOOLEAN DEFAULT false, -- Is this a reusable template?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_programs_trainer ON workout_programs(trainer_id);
CREATE INDEX idx_workout_programs_public ON workout_programs(is_public) WHERE is_public = true;

-- ================================================
-- PROGRAM DAYS TABLE
-- Days within a workout program
-- ================================================
CREATE TABLE IF NOT EXISTS program_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES workout_programs(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL, -- 1, 2, 3, etc.
    name TEXT NOT NULL, -- "Push Day", "Leg Day", etc.
    description TEXT,
    estimated_duration_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_program_days_program ON program_days(program_id);

-- ================================================
-- EXERCISES LIBRARY TABLE
-- Master list of exercises
-- ================================================
CREATE TABLE IF NOT EXISTS exercises_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    muscle_group TEXT NOT NULL, -- Primary muscle group
    secondary_muscles TEXT[], -- Array of secondary muscles
    equipment TEXT[], -- Required equipment
    difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    video_url TEXT,
    instructions TEXT[],
    tips TEXT[],
    is_compound BOOLEAN DEFAULT false,
    created_by UUID REFERENCES trainers(id), -- NULL for system exercises
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exercises_muscle_group ON exercises_library(muscle_group);
CREATE INDEX idx_exercises_name ON exercises_library(name);

-- ================================================
-- PROGRAM EXERCISES TABLE
-- Exercises assigned to program days
-- ================================================
CREATE TABLE IF NOT EXISTS program_exercises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_day_id UUID REFERENCES program_days(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises_library(id) ON DELETE SET NULL,
    custom_exercise_name TEXT, -- If not from library
    sets INTEGER NOT NULL DEFAULT 3,
    reps_min INTEGER DEFAULT 8,
    reps_max INTEGER DEFAULT 12,
    rest_seconds INTEGER DEFAULT 90,
    tempo TEXT, -- e.g., "3-1-2-0" for eccentric-pause-concentric-pause
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_program_exercises_day ON program_exercises(program_day_id);

-- ================================================
-- WORKOUTS TABLE (Scheduled/Completed Sessions)
-- Actual workout instances for clients
-- ================================================
CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES trainer_clients(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
    program_day_id UUID REFERENCES program_days(id) ON DELETE SET NULL, -- Optional link to program
    name TEXT NOT NULL,
    scheduled_date DATE,
    scheduled_time TIME,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'missed', 'cancelled')),
    notes TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Client's workout rating
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workouts_client ON workouts(client_id);
CREATE INDEX idx_workouts_trainer ON workouts(trainer_id);
CREATE INDEX idx_workouts_date ON workouts(scheduled_date);
CREATE INDEX idx_workouts_status ON workouts(status);

-- ================================================
-- WORKOUT SETS TABLE (Logged Exercise Sets)
-- Individual sets logged during a workout
-- ================================================
CREATE TABLE IF NOT EXISTS workout_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises_library(id) ON DELETE SET NULL,
    custom_exercise_name TEXT, -- If not from library
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight DECIMAL(10,2), -- Weight in user's preferred unit
    weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg')),
    rpe INTEGER CHECK (rpe >= 1 AND rpe <= 10), -- Rate of Perceived Exertion
    is_warmup BOOLEAN DEFAULT false,
    is_pr BOOLEAN DEFAULT false, -- Personal record flag
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_sets_workout ON workout_sets(workout_id);
CREATE INDEX idx_workout_sets_exercise ON workout_sets(exercise_id);

-- ================================================
-- PROGRESS LOGS TABLE
-- Body measurements and progress tracking
-- ================================================
CREATE TABLE IF NOT EXISTS progress_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES trainer_clients(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight DECIMAL(5,2), -- Body weight
    weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg')),
    body_fat_percentage DECIMAL(4,1),
    measurements JSONB, -- Flexible: {"chest": 42, "waist": 32, "hips": 38, "arms": 15, "thighs": 24}
    photos TEXT[], -- Array of photo URLs
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    sleep_hours DECIMAL(3,1),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_logs_client ON progress_logs(client_id);
CREATE INDEX idx_progress_logs_date ON progress_logs(log_date);

-- ================================================
-- PERSONAL RECORDS TABLE
-- Track PRs for each exercise
-- ================================================
CREATE TABLE IF NOT EXISTS personal_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES trainer_clients(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES exercises_library(id) ON DELETE CASCADE,
    record_type TEXT NOT NULL CHECK (record_type IN ('1rm', '3rm', '5rm', '10rm', 'max_reps', 'max_weight')),
    value DECIMAL(10,2) NOT NULL,
    unit TEXT DEFAULT 'lbs',
    achieved_at DATE NOT NULL DEFAULT CURRENT_DATE,
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personal_records_client ON personal_records(client_id);
CREATE INDEX idx_personal_records_exercise ON personal_records(exercise_id);

-- ================================================
-- FORM ANALYSES TABLE
-- AI form analysis results
-- ================================================
CREATE TABLE IF NOT EXISTS form_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES trainer_clients(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES trainers(id) ON DELETE SET NULL,
    exercise_id UUID REFERENCES exercises_library(id) ON DELETE SET NULL,
    exercise_name TEXT NOT NULL,
    video_url TEXT,
    score INTEGER CHECK (score >= 0 AND score <= 100),
    issues JSONB, -- Array of issues detected
    corrections JSONB, -- Array of corrections recommended
    recommendation TEXT,
    credits_used INTEGER DEFAULT 5,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_analyses_client ON form_analyses(client_id);
CREATE INDEX idx_form_analyses_trainer ON form_analyses(trainer_id);

-- ================================================
-- NUTRITION LOGS TABLE
-- Meal and macro tracking
-- ================================================
CREATE TABLE IF NOT EXISTS nutrition_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES trainer_clients(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout')),
    description TEXT,
    calories INTEGER,
    protein_g DECIMAL(6,1),
    carbs_g DECIMAL(6,1),
    fat_g DECIMAL(6,1),
    fiber_g DECIMAL(5,1),
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nutrition_logs_client ON nutrition_logs(client_id);
CREATE INDEX idx_nutrition_logs_date ON nutrition_logs(log_date);

-- ================================================
-- COACHING PRODUCTS TABLE
-- Programs/packages for sale
-- ================================================
CREATE TABLE IF NOT EXISTS coaching_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID REFERENCES trainers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    product_type TEXT CHECK (product_type IN ('subscription', 'one_time', 'program')),
    price_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    duration_weeks INTEGER, -- For programs
    sessions_per_week INTEGER, -- For subscriptions
    features JSONB, -- Array of included features
    stripe_price_id TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coaching_products_trainer ON coaching_products(trainer_id);
CREATE INDEX idx_coaching_products_active ON coaching_products(is_active) WHERE is_active = true;

-- ================================================
-- MESSAGES TABLE
-- Client-trainer communication
-- ================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL, -- Can be trainer or client
    recipient_id UUID NOT NULL,
    thread_id UUID, -- Group messages by conversation
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);
CREATE INDEX idx_messages_unread ON messages(recipient_id, is_read) WHERE is_read = false;

-- ================================================
-- SUITE APP ENTRY
-- Add FitCoach to the suite_apps table
-- ================================================
INSERT INTO suite_apps (name, slug, tagline, description, category, status, icon_url, app_url)
VALUES (
    'FitCoach',
    'fitcoach',
    'Your AI-powered personal training companion',
    'Track workouts, log progress, get AI form analysis, and follow personalized training programs. Whether you are a trainer managing clients or an individual chasing gains, FitCoach has you covered.',
    'Health',
    'published',
    '/assets/apps/fitcoach-icon.png',
    '/apps-subpages/fitcoach.html'
) ON CONFLICT (slug) DO NOTHING;

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

-- Enable RLS on all tables
ALTER TABLE trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Trainers can only see their own data
CREATE POLICY "Trainers can view own profile"
    ON trainers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Trainers can update own profile"
    ON trainers FOR UPDATE
    USING (auth.uid() = user_id);

-- Trainers can manage their own clients
CREATE POLICY "Trainers can manage own clients"
    ON trainer_clients FOR ALL
    USING (trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()));

-- Similar policies for other tables...
CREATE POLICY "Trainers can manage own programs"
    ON workout_programs FOR ALL
    USING (trainer_id IN (SELECT id FROM trainers WHERE user_id = auth.uid()));

CREATE POLICY "Public programs are viewable by all"
    ON workout_programs FOR SELECT
    USING (is_public = true);

-- ================================================
-- FUNCTIONS
-- ================================================

-- Function to calculate estimated 1RM
CREATE OR REPLACE FUNCTION calculate_1rm(weight DECIMAL, reps INTEGER)
RETURNS DECIMAL AS $$
BEGIN
    -- Epley formula
    IF reps = 1 THEN
        RETURN weight;
    END IF;
    RETURN ROUND(weight * (1 + reps / 30.0), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get client's PR for an exercise
CREATE OR REPLACE FUNCTION get_client_pr(p_client_id UUID, p_exercise_id UUID)
RETURNS TABLE (
    record_type TEXT,
    value DECIMAL,
    achieved_at DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT pr.record_type, pr.value, pr.achieved_at
    FROM personal_records pr
    WHERE pr.client_id = p_client_id
    AND pr.exercise_id = p_exercise_id
    ORDER BY pr.achieved_at DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-detect PRs when logging workout sets
CREATE OR REPLACE FUNCTION check_for_pr()
RETURNS TRIGGER AS $$
DECLARE
    current_1rm DECIMAL;
    previous_1rm DECIMAL;
BEGIN
    -- Calculate estimated 1RM for this set
    current_1rm := calculate_1rm(NEW.weight, NEW.reps);

    -- Get previous best 1RM for this exercise
    SELECT MAX(calculate_1rm(ws.weight, ws.reps)) INTO previous_1rm
    FROM workout_sets ws
    JOIN workouts w ON ws.workout_id = w.id
    WHERE w.client_id = (SELECT client_id FROM workouts WHERE id = NEW.workout_id)
    AND ws.exercise_id = NEW.exercise_id
    AND ws.id != NEW.id;

    -- Mark as PR if it's a new record
    IF previous_1rm IS NULL OR current_1rm > previous_1rm THEN
        NEW.is_pr := true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_pr_trigger
    BEFORE INSERT ON workout_sets
    FOR EACH ROW
    EXECUTE FUNCTION check_for_pr();
