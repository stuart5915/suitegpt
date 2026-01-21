-- Add Cadence AI to the apps table

INSERT INTO apps (
    slug,
    name,
    tagline,
    category,
    emoji_icon,
    app_url,
    status,
    total_funded,
    funder_count,
    total_revenue,
    creator_name
) VALUES (
    'cadence-ai',
    'Cadence AI',
    'AI-powered marketing automation',
    'Marketing',
    '🎯',
    'https://cadence-ai-nextjs.vercel.app',
    'approved',
    0,
    0,
    0,
    'SUITE'
);
