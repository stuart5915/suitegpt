-- Add Article Writer to the apps table

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
    'article-writer',
    'Article Writer',
    'AI-powered article refinement and publishing',
    'Creative',
    '✍️',
    '/article-writer.html',
    'live',
    0,
    0,
    0,
    'SUITE'
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    app_url = EXCLUDED.app_url,
    status = EXCLUDED.status;
