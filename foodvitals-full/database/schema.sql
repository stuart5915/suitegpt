-- ============================================
-- FoodVitalsAI Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- NUTRITION GOALS TABLE
-- User's target macros and preferences
-- ============================================
CREATE TABLE IF NOT EXISTS nutrition_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  
  -- User profile for RDA calculations
  age INTEGER DEFAULT 30,
  gender TEXT DEFAULT 'male', -- 'male' or 'female'
  weight_kg INTEGER,
  
  -- Daily targets
  target_calories INTEGER DEFAULT 2000,
  target_protein_g INTEGER DEFAULT 150,
  target_carbs_g INTEGER DEFAULT 200,
  target_fat_g INTEGER DEFAULT 70,
  target_fiber_g INTEGER DEFAULT 30,
  
  -- Basic micronutrients
  target_vitamin_c_mg INTEGER DEFAULT 90,
  target_vitamin_d_mcg INTEGER DEFAULT 20,
  target_calcium_mg INTEGER DEFAULT 1000,
  target_iron_mg INTEGER DEFAULT 18,
  target_potassium_mg INTEGER DEFAULT 3500,
  target_sodium_mg INTEGER DEFAULT 2300,
  
  -- Preferences
  diet_type TEXT DEFAULT 'standard', -- standard, keto, vegan, vegetarian, etc.
  activity_level TEXT DEFAULT 'moderate', -- sedentary, light, moderate, active, very_active
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own nutrition goals" ON nutrition_goals
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FOOD LOGS TABLE
-- Each meal/snack entry
-- ============================================
CREATE TABLE IF NOT EXISTS food_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- When the food was eaten
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  meal_type TEXT, -- breakfast, lunch, dinner, snack
  
  -- Raw input from user
  raw_input TEXT, -- "3 eggs, 1 slice sourdough"
  photo_url TEXT, -- optional photo
  
  -- AI-parsed + user-verified totals
  total_calories INTEGER,
  total_protein_g FLOAT,
  total_carbs_g FLOAT,
  total_fat_g FLOAT,
  total_fiber_g FLOAT,
  
  -- Basic micronutrients
  total_vitamin_c_mg FLOAT,
  total_vitamin_d_mcg FLOAT,
  total_calcium_mg FLOAT,
  total_iron_mg FLOAT,
  total_potassium_mg FLOAT,
  total_sodium_mg FLOAT,
  
  -- AI confidence and user verification
  ai_confidence FLOAT, -- 0-1
  user_verified BOOLEAN DEFAULT FALSE,
  gemini_model TEXT, -- which model was used
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own food logs" ON food_logs
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FOOD ITEMS TABLE
-- Individual food items within a log
-- ============================================
CREATE TABLE IF NOT EXISTS food_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_log_id UUID REFERENCES food_logs(id) ON DELETE CASCADE,
  
  -- Item details
  name TEXT NOT NULL, -- "egg"
  quantity FLOAT NOT NULL, -- 3
  unit TEXT, -- "whole", "g", "oz", "cup", "slice"
  
  -- Nutrition per item (AI-parsed)
  calories INTEGER,
  protein_g FLOAT,
  carbs_g FLOAT,
  fat_g FLOAT,
  fiber_g FLOAT,
  
  -- Basic micronutrients
  vitamin_c_mg FLOAT,
  vitamin_d_mcg FLOAT,
  calcium_mg FLOAT,
  iron_mg FLOAT,
  potassium_mg FLOAT,
  sodium_mg FLOAT,
  
  -- USDA reference (if matched)
  usda_fdc_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own food items" ON food_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM food_logs WHERE food_logs.id = food_items.food_log_id AND food_logs.user_id = auth.uid()
    )
  );

-- ============================================
-- DAILY SUMMARIES TABLE
-- Pre-computed daily totals for fast queries
-- ============================================
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  summary_date DATE NOT NULL,
  
  -- Totals
  total_calories INTEGER DEFAULT 0,
  total_protein_g FLOAT DEFAULT 0,
  total_carbs_g FLOAT DEFAULT 0,
  total_fat_g FLOAT DEFAULT 0,
  total_fiber_g FLOAT DEFAULT 0,
  
  -- Micronutrients
  total_vitamin_c_mg FLOAT DEFAULT 0,
  total_vitamin_d_mcg FLOAT DEFAULT 0,
  total_calcium_mg FLOAT DEFAULT 0,
  total_iron_mg FLOAT DEFAULT 0,
  total_potassium_mg FLOAT DEFAULT 0,
  total_sodium_mg FLOAT DEFAULT 0,
  
  -- Streak tracking
  log_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, summary_date)
);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily summaries" ON daily_summaries
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- AI INSIGHTS TABLE
-- Weekly/monthly AI-generated recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  insight_type TEXT NOT NULL, -- 'weekly', 'monthly', 'achievement'
  period_start DATE,
  period_end DATE,
  
  -- AI-generated content
  summary TEXT,
  missing_nutrients TEXT[], -- ["Vitamin D", "Fiber"]
  recommendations JSONB, -- [{suggestion: "Add salmon 2x/week", reason: "Low omega-3"}]
  achievements TEXT[], -- ["Hit protein goal 5 days!", "New streak: 7 days"]
  
  gemini_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI insights" ON ai_insights
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FAVORITE MEALS TABLE
-- User's saved favorite meals for quick re-logging
-- ============================================
CREATE TABLE IF NOT EXISTS favorite_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Meal details
  name TEXT NOT NULL,
  description TEXT,
  
  -- Macros
  calories INTEGER,
  protein_g FLOAT,
  carbs_g FLOAT,
  fat_g FLOAT,
  fiber_g FLOAT,
  
  -- Source tracking
  source TEXT DEFAULT 'manual', -- 'ai_suggestion', 'logged_meal', 'manual'
  source_log_id UUID REFERENCES food_logs(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own favorite meals" ON favorite_meals
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- SAVED TIPS TABLE
-- AI tips/insights saved by user from chat
-- ============================================
CREATE TABLE IF NOT EXISTS saved_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Tip content
  content TEXT NOT NULL,
  source TEXT DEFAULT 'insights_chat', -- 'insights_chat', 'quick_insight', 'weekly_summary'
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved tips" ON saved_tips
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_food_logs_user_id ON food_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_food_logs_logged_at ON food_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_food_items_food_log_id ON food_items(food_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date ON daily_summaries(user_id, summary_date);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_meals_user_id ON favorite_meals(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_tips_user_id ON saved_tips(user_id);
