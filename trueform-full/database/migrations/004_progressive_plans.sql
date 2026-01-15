-- ============================================
-- PROGRESSIVE WEEK-BY-WEEK REHAB PLANS
-- Run this in Supabase SQL Editor
-- Adds columns for week-based exercise progression
-- ============================================

-- Add exercises_by_week column for progressive week structure
-- Format: [{week: 1, phase: 'acute', phaseGoal: '...', exercises: [...]}]
ALTER TABLE rehab_plans 
ADD COLUMN IF NOT EXISTS exercises_by_week JSONB DEFAULT NULL;

-- Add progression_strategy column for AI explanation of plan progression  
ALTER TABLE rehab_plans 
ADD COLUMN IF NOT EXISTS progression_strategy TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN rehab_plans.exercises_by_week IS 'Progressive week-by-week exercise structure with phases (acute/subacute/strengthening/maintenance)';
COMMENT ON COLUMN rehab_plans.progression_strategy IS 'AI explanation of how exercises progress over the plan duration';
