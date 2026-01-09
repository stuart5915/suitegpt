-- Update Cheshbon with icon and screenshots
-- Run in SUITE Ecosystem Supabase: https://supabase.com/dashboard/project/rdsmdywbdiskxknluiym

UPDATE suite_apps 
SET 
    icon_url = 'https://getsuite.app/assets/cheshbon-icon.png',
    screenshots = ARRAY[
        'https://getsuite.app/assets/cheshbon-screenshots/screenshot-1.png',
        'https://getsuite.app/assets/cheshbon-screenshots/screenshot-2.png',
        'https://getsuite.app/assets/cheshbon-screenshots/screenshot-3.png',
        'https://getsuite.app/assets/cheshbon-screenshots/screenshot-4.png',
        'https://getsuite.app/assets/cheshbon-screenshots/screenshot-5.png'
    ],
    updated_at = NOW()
WHERE slug = 'cheshbon-reflections';

-- Verify
SELECT name, icon_url, screenshots FROM suite_apps WHERE slug = 'cheshbon-reflections';
