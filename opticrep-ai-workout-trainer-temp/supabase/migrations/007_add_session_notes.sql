-- Add notes column to workout_sessions table
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS notes TEXT;
