-- Seed SUITE Apps
-- Run this in Supabase SQL Editor to populate all apps

-- First, update the category constraint to allow more categories
ALTER TABLE suite_apps DROP CONSTRAINT IF EXISTS suite_apps_category_check;
ALTER TABLE suite_apps ADD CONSTRAINT suite_apps_category_check
    CHECK (category IN ('health', 'productivity', 'finance', 'creative', 'games', 'lifestyle', 'spirituality', 'other'));

INSERT INTO suite_apps (name, slug, tagline, description, category, status, icon_url, app_url) VALUES
    ('FoodVitals', 'foodvitals', 'Nutrition scanner', 'Scan food labels and get instant nutrition analysis with AI', 'health', 'published', '/assets/icons/foodvitals-icon.png', '/foodvitals/index.html'),
    ('TrueForm', 'trueform', 'Recovery tracking', 'Track your fitness recovery with AI-powered insights', 'health', 'published', '/assets/icons/trueform-icon.jpg', NULL),
    ('OpticRep', 'opticrep', 'AI rep counter', 'AI-powered workout rep counter using your camera', 'health', 'published', '/assets/icons/opticrep-icon.png', NULL),
    ('Proto Golf', 'proto-golf', 'Your golf companion', 'AI-powered golf equipment fitting and tracking', 'other', 'published', '/assets/icons/protogolf-icon.jpg', '/proto-golf.html'),
    ('Cheshbon', 'cheshbon', 'Daily reflection', 'AI-guided daily reflection and journaling', 'productivity', 'published', '/assets/icons/cheshbon-icon.png', '/cheshbon.html'),
    ('NoteBox', 'notebox', 'Audio learning', 'Turn podcasts and videos into actionable notes', 'productivity', 'published', '/assets/icons/notebox-icon.png', '/notebox.html'),
    ('RemCast', 'remcast', 'Voice memos', 'Record voice memos and get AI summaries', 'productivity', 'published', '/assets/icons/remcast-icon.png', NULL),
    ('SUITEhub', 'suitehub', 'Your AI assistant', 'Central AI hub connected to all your SUITE apps', 'productivity', 'published', '/assets/suite-logo-new.png', '/suitehub.html'),
    ('Cadence AI', 'cadence-ai', 'Content creation', 'AI-powered social media content scheduling', 'creative', 'published', '/assets/icons/cadence-icon.png', NULL),
    ('Life Hub', 'life-hub', 'Life dashboard', 'Personal dashboard for goals, habits, and reflections', 'productivity', 'published', '/assets/icons/life-hub-icon.png', NULL),
    ('Deal Tracker', 'deal-tracker', 'Find deals', 'Track local deals and discounts', 'finance', 'published', '/assets/icons/deal-tracker-icon.png', NULL),
    ('DeFi Knowledge', 'defi-knowledge', 'Master DeFi', 'Learn decentralized finance with AI tutoring', 'finance', 'published', '/assets/icons/defi-knowledge-icon.png', NULL)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    status = EXCLUDED.status,
    icon_url = EXCLUDED.icon_url,
    app_url = EXCLUDED.app_url;
