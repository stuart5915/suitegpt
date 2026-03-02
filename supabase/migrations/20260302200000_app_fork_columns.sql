-- App Store Phase 3: fork tracking columns

ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS forked_from_user_app UUID REFERENCES user_apps(id) ON DELETE SET NULL;
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS revenue_split INTEGER DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_user_apps_forked_from ON user_apps(forked_from_user_app) WHERE forked_from_user_app IS NOT NULL;
