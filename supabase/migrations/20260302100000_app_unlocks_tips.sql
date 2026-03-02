-- App Store Phase 2: unlock payments + tips

CREATE TABLE IF NOT EXISTS app_unlocks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL,
    app_id UUID NOT NULL REFERENCES user_apps(id) ON DELETE CASCADE,
    tx_hash TEXT NOT NULL UNIQUE,
    amount DECIMAL NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_tips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL,
    app_id UUID NOT NULL REFERENCES user_apps(id) ON DELETE CASCADE,
    tx_hash TEXT NOT NULL UNIQUE,
    amount DECIMAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_unlocks_profile ON app_unlocks(profile_id);
CREATE INDEX IF NOT EXISTS idx_app_unlocks_app ON app_unlocks(app_id);
CREATE INDEX IF NOT EXISTS idx_app_unlocks_profile_app ON app_unlocks(profile_id, app_id);
CREATE INDEX IF NOT EXISTS idx_app_tips_app ON app_tips(app_id);
