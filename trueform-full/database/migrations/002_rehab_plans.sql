-- ============================================
-- REHAB PLANS AND EXERCISE TRACKING
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- REHAB PLANS TABLE
-- Stores user's active rehabilitation plan
-- ============================================
CREATE TABLE IF NOT EXISTS rehab_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  source_report_id UUID, -- Links to the movement report that generated this plan
  title TEXT NOT NULL,
  
  -- AI-recommended configuration (dynamic based on analysis)
  duration_weeks INTEGER NOT NULL DEFAULT 4,
  exercises_per_day INTEGER NOT NULL DEFAULT 3,
  check_in_frequency TEXT DEFAULT 'weekly', -- weekly, biweekly
  ai_reasoning TEXT, -- Why AI recommended this duration/frequency
  
  -- Exercise list as JSONB array
  -- Format: [{id, name, sets, reps_or_duration, frequency_per_week, description}]
  exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Plan lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rehab_plans ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own plans
CREATE POLICY "Users can view own rehab plans" ON rehab_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rehab plans" ON rehab_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rehab plans" ON rehab_plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rehab plans" ON rehab_plans
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- EXERCISE COMPLETIONS TABLE
-- Tracks daily exercise check-offs
-- ============================================
CREATE TABLE IF NOT EXISTS exercise_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES rehab_plans(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  
  exercise_id TEXT NOT NULL, -- Matches exercise id from plan's exercises array
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional feedback
  pain_level INTEGER CHECK (pain_level >= 0 AND pain_level <= 10),
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own completions
CREATE POLICY "Users can view own exercise completions" ON exercise_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own exercise completions" ON exercise_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own exercise completions" ON exercise_completions
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_rehab_plans_user_id ON rehab_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_rehab_plans_status ON rehab_plans(status);
CREATE INDEX IF NOT EXISTS idx_exercise_completions_plan_id ON exercise_completions(plan_id);
CREATE INDEX IF NOT EXISTS idx_exercise_completions_user_id ON exercise_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_completions_date ON exercise_completions(completed_at);

-- ============================================
-- HELPER FUNCTION: Deactivate old plans when new one is created
-- ============================================
CREATE OR REPLACE FUNCTION deactivate_old_plans()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark any existing active plans as abandoned
  UPDATE rehab_plans 
  SET status = 'abandoned', updated_at = NOW()
  WHERE user_id = NEW.user_id 
    AND status = 'active' 
    AND id != NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_rehab_plan_created
  AFTER INSERT ON rehab_plans
  FOR EACH ROW EXECUTE FUNCTION deactivate_old_plans();
