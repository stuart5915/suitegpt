-- Add Cheshbon Reflections to the app store
-- Run this in your Supabase SQL Editor

INSERT INTO apps (name, slug, description, icon_url, creator_name, app_url, status, category) VALUES
    (
        'Cheshbon Reflections',
        'cheshbon-reflections',
        'Daily Bible reading with AI-powered insights and community discussion. Reflect on Scripture together.',
        NULL,
        'Stuart H.',
        'https://cheshbon.getsuite.app',
        'approved',
        'lifestyle'
    )
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status;
