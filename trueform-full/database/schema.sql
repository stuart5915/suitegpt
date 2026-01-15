-- TrueForm AI Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xhbrrmlgaueeycasodma/sql

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- PAIN CONTEXT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pain_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  pain_areas TEXT[],
  pain_duration TEXT,
  pain_triggers TEXT[],
  goals TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pain_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pain context" ON pain_context
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SCANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  duration_seconds INTEGER,
  pose_data JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own scans" ON scans
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PAIN POINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS pain_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  timestamp_seconds FLOAT,
  pose_snapshot JSONB,
  intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
  body_part TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pain_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own pain points" ON pain_points
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM scans WHERE scans.id = pain_points.scan_id AND scans.user_id = auth.uid()
    )
  );

-- ============================================
-- PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  generated_from_scan UUID REFERENCES scans(id),
  exercises JSONB,
  frequency TEXT,
  duration_weeks INTEGER,
  ai_reasoning TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plans" ON plans
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- WORKOUT LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10)
);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout logs" ON workout_logs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_pain_points_scan_id ON pain_points(scan_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_plan_id ON workout_logs(plan_id);
