-- Fix user_apps: make user_id nullable (publish flow uses publisher_email, not user_id)
-- Also drop the slug auto-generation trigger (publish-site.js sets slug explicitly)

-- 1. Make user_id nullable so the publish API can insert without auth.users reference
ALTER TABLE user_apps ALTER COLUMN user_id DROP NOT NULL;

-- 2. Make code nullable so we can import apps from other tables that only have app_url
ALTER TABLE user_apps ALTER COLUMN code DROP NOT NULL;

-- 3. Add app_url column for apps that link externally instead of storing code
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS app_url TEXT;

-- 4. Drop the slug auto-generation trigger (it overwrites the user-provided slug)
DROP TRIGGER IF EXISTS generate_user_app_slug ON user_apps;

-- 5. Import existing apps from the 'apps' table (21 rows — approved Discord/VoiceForge apps)
INSERT INTO user_apps (name, slug, description, category, is_public, is_listed, app_url, publisher_email, source, created_at)
SELECT
    a.name,
    a.slug,
    a.description,
    CASE
        WHEN a.category IN ('tools', 'games', 'creative', 'finance', 'social', 'other') THEN a.category
        WHEN a.category = 'fitness' THEN 'other'
        WHEN a.category = 'health' THEN 'other'
        WHEN a.category = 'utility' THEN 'tools'
        WHEN a.category = 'productivity' THEN 'tools'
        ELSE 'other'
    END,
    true,    -- is_public
    true,    -- is_listed (show on app store)
    a.app_url,
    a.creator_name,  -- use creator_name as publisher_email placeholder
    'imported-from-apps',
    COALESCE(a.created_at, now())
FROM apps a
WHERE a.status IN ('approved', 'featured', 'live')
ON CONFLICT (slug) DO NOTHING;

-- 6. Import existing apps from 'suite_apps' table (13 rows — official SUITE ecosystem)
INSERT INTO user_apps (name, slug, description, category, is_public, is_listed, app_url, publisher_email, source, created_at)
SELECT
    sa.name,
    sa.slug,
    COALESCE(sa.description, sa.tagline),
    CASE
        WHEN sa.category IN ('tools', 'games', 'creative', 'finance', 'social', 'other') THEN sa.category
        WHEN sa.category = 'health' THEN 'other'
        WHEN sa.category = 'productivity' THEN 'tools'
        ELSE 'other'
    END,
    true,    -- is_public
    true,    -- is_listed
    sa.icon_url,  -- suite_apps don't have app_url in all cases, use icon_url as fallback
    'SUITE Team',
    'imported-from-suite-apps',
    COALESCE(sa.created_at, now())
FROM suite_apps sa
WHERE sa.status != 'hidden'
ON CONFLICT (slug) DO NOTHING;
