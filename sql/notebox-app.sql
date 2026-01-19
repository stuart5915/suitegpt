-- Add NoteBox to the apps table

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
    'notebox',
    'NoteBox',
    'Capture ideas, notes & tasks instantly',
    'Productivity',
    '📦',
    '/notebox.html',
    'live',
    0,
    0,
    0,
    'SUITE'
);
