-- Add featured flag to user_apps for staff-pick / featured apps
ALTER TABLE user_apps ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_user_apps_featured ON user_apps (featured) WHERE featured = true;
