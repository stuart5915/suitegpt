-- Cleanup script for admin dashboard
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/rdsmdywbdiskxknluiym/sql

-- 1. First, let's see what's currently in the apps table
SELECT id, name, slug, tagline, status FROM apps ORDER BY name;

-- 2. Delete "SUITE Ecosystem" (has no tagline, shouldn't be there)
DELETE FROM apps WHERE slug = 'suite-ecosystem' OR name = 'SUITE Ecosystem';

-- 3. Delete "Life Hub" (the wrong one with "Life dashboard" tagline)
DELETE FROM apps WHERE slug = 'life-hub' OR name = 'Life Hub';

-- 4. Delete the wrong "Cheshbon" with "Daily reflection" tagline
-- (Keep "Cheshbon Reflections" which is the real app)
DELETE FROM apps WHERE slug = 'cheshbon' AND tagline = 'Daily reflection';

-- 5. Make sure "Cheshbon Reflections" is approved (not pending)
UPDATE apps
SET status = 'approved'
WHERE slug = 'cheshbon-reflections';

-- 6. Verify the cleanup worked
SELECT id, name, slug, tagline, status FROM apps ORDER BY name;
