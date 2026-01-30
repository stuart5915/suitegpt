-- Add project_context field to suite_operators
-- Stores project description, tech stack, conventions for Claude to use
ALTER TABLE suite_operators
    ADD COLUMN IF NOT EXISTS project_context text;
