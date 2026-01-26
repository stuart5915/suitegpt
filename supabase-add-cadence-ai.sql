-- Add Cadence AI to the apps table
-- Run this in your Supabase SQL Editor

INSERT INTO apps (name, slug, description, icon_url, creator_name, app_url, status, category)
VALUES (
    'Cadence AI',
    'cadence-ai',
    'AI-powered social media scheduling. Generate content, schedule posts, and manage your social presence with AI.',
    '/assets/icons/cadence-icon.jpg',
    'SUITE',
    'https://cadence-ai-nextjs.vercel.app',
    'approved',
    'productivity'
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    icon_url = EXCLUDED.icon_url,
    app_url = EXCLUDED.app_url,
    status = EXCLUDED.status,
    category = EXCLUDED.category;
