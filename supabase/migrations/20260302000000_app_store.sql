-- App Store: add store columns to user_apps + upvotes table

-- Add app store columns to user_apps
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS claws_price DECIMAL DEFAULT 0;
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS creator_wallet TEXT;
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS creator_x_handle TEXT;
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS upvote_count INTEGER DEFAULT 0;

-- Upvotes table
CREATE TABLE IF NOT EXISTS app_upvotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL,
    app_id UUID NOT NULL REFERENCES user_apps(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(profile_id, app_id)
);

CREATE INDEX IF NOT EXISTS idx_app_upvotes_app ON app_upvotes(app_id);
CREATE INDEX IF NOT EXISTS idx_app_upvotes_profile ON app_upvotes(profile_id);
CREATE INDEX IF NOT EXISTS idx_user_apps_listed ON user_apps(is_listed, is_public) WHERE is_listed = true AND is_public = true;
CREATE INDEX IF NOT EXISTS idx_user_apps_category ON user_apps(category) WHERE is_listed = true AND is_public = true;
