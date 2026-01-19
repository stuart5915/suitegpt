-- Update claude_tasks to allow more targets
-- Run this to add 'stuartfactory' and other targets

-- Drop the old constraint
ALTER TABLE claude_tasks DROP CONSTRAINT IF EXISTS claude_tasks_target_check;

-- Add new constraint with more targets
ALTER TABLE claude_tasks
ADD CONSTRAINT claude_tasks_target_check
CHECK (target IN ('suite', 'artstu', 'stuartfactory', 'trueform', 'foodvitals', 'learn'));

-- Also make idea_id optional (it can be null for stuartfactorybot tasks)
-- This is likely already the case, but just to be sure
ALTER TABLE claude_tasks ALTER COLUMN idea_id DROP NOT NULL;
