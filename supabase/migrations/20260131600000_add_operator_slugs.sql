-- Add slug column to suite_operators for unique URL routing
ALTER TABLE suite_operators ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Set slugs for existing community apps
UPDATE suite_operators SET slug = 'job-hunter' WHERE name = 'Job Hunter';
UPDATE suite_operators SET slug = 'client-hub' WHERE name = 'Client Hub';
