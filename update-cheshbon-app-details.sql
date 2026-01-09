-- Update Cheshbon Reflections in suite_apps table (Cadence Database)
-- Run this in your Cadence Supabase SQL Editor: https://supabase.com/dashboard/project/tbfpopablanksrzyxaxj

-- First, check if the app exists
SELECT * FROM suite_apps WHERE slug = 'cheshbon-reflections';

-- Update the app with icon_url and app_url
UPDATE suite_apps 
SET 
    icon_url = 'https://cheshbon.getsuite.app/icon.png',  -- Replace with actual icon URL
    app_url = 'https://cheshbon.getsuite.app',
    download_url = 'https://cheshbon.getsuite.app',
    status = 'published'
WHERE slug = 'cheshbon-reflections';

-- If the app doesn't exist, insert it
INSERT INTO suite_apps (name, slug, description, icon_url, app_url, download_url, status, category)
VALUES (
    'Cheshbon Reflections',
    'cheshbon-reflections',
    'Journal through the Bible at your own pace with AI-powered insights',
    'https://cheshbon.getsuite.app/icon.png',  -- Replace with actual icon URL
    'https://cheshbon.getsuite.app',
    'https://cheshbon.getsuite.app',
    'published',
    'Spirituality'
)
ON CONFLICT (slug) DO UPDATE SET
    icon_url = EXCLUDED.icon_url,
    app_url = EXCLUDED.app_url,
    download_url = EXCLUDED.download_url,
    status = EXCLUDED.status;
