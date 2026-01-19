-- =====================================================
-- SUITE Shell Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. APP REQUESTS TABLE
-- Stores feature requests and bug reports for each app
-- =====================================================

CREATE TABLE IF NOT EXISTS app_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_slug TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('feature', 'bug')),
    description TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    votes INTEGER DEFAULT 1,
    voted_by TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'wont_fix')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_app_requests_app_slug ON app_requests(app_slug);

-- Index for sorting by votes
CREATE INDEX IF NOT EXISTS idx_app_requests_votes ON app_requests(votes DESC);

-- Enable Row Level Security
ALTER TABLE app_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read requests
DROP POLICY IF EXISTS "Anyone can read app_requests" ON app_requests;
CREATE POLICY "Anyone can read app_requests" ON app_requests
    FOR SELECT USING (true);

-- Policy: Authenticated users can insert (using anon key for now)
DROP POLICY IF EXISTS "Anyone can insert app_requests" ON app_requests;
CREATE POLICY "Anyone can insert app_requests" ON app_requests
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update votes (for voting system)
DROP POLICY IF EXISTS "Anyone can update app_requests votes" ON app_requests;
CREATE POLICY "Anyone can update app_requests votes" ON app_requests
    FOR UPDATE USING (true);


-- 2. ADD TOTAL_FUNDED COLUMN TO APPS TABLE (if not exists)
-- Tracks how much yield has been directed to each app
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'total_funded'
    ) THEN
        ALTER TABLE apps ADD COLUMN total_funded DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;

-- Add emoji_icon column if not exists (for app icons)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'emoji_icon'
    ) THEN
        ALTER TABLE apps ADD COLUMN emoji_icon TEXT;
    END IF;
END $$;

-- Add graduated app link columns
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'website_url'
    ) THEN
        ALTER TABLE apps ADD COLUMN website_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'ios_url'
    ) THEN
        ALTER TABLE apps ADD COLUMN ios_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'android_url'
    ) THEN
        ALTER TABLE apps ADD COLUMN android_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'twitter_url'
    ) THEN
        ALTER TABLE apps ADD COLUMN twitter_url TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'apps' AND column_name = 'description'
    ) THEN
        ALTER TABLE apps ADD COLUMN description TEXT;
    END IF;
END $$;


-- 3. SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Update apps with some sample funding data
UPDATE apps SET total_funded = 847 WHERE slug = 'foodvitals';
UPDATE apps SET total_funded = 234 WHERE slug = 'cheshbon';
UPDATE apps SET total_funded = 156 WHERE slug = 'opticrep';
UPDATE apps SET total_funded = 89 WHERE slug = 'trueform';

-- Update apps with emoji icons
UPDATE apps SET emoji_icon = '🥗' WHERE slug = 'foodvitals';
UPDATE apps SET emoji_icon = '💰' WHERE slug = 'cheshbon';
UPDATE apps SET emoji_icon = '👁️' WHERE slug = 'opticrep';
UPDATE apps SET emoji_icon = '🏋️' WHERE slug = 'trueform';
UPDATE apps SET emoji_icon = '💤' WHERE slug = 'remcast';

-- Insert sample requests (optional - for testing UI)
INSERT INTO app_requests (app_slug, type, description, user_id, user_name, votes, voted_by) VALUES
    ('foodvitals', 'feature', 'Add barcode scanning for packaged foods', 'test_user_1', 'TestUser', 12, ARRAY['test_user_1', 'user_2', 'user_3']),
    ('foodvitals', 'bug', 'Camera doesn''t work on Safari iOS', 'test_user_2', 'BugHunter', 8, ARRAY['test_user_2', 'user_4']),
    ('foodvitals', 'feature', 'Meal planning and weekly prep suggestions', 'test_user_3', 'FitnessFan', 6, ARRAY['test_user_3']),
    ('foodvitals', 'feature', 'Integration with Apple Health', 'test_user_4', 'HealthNut', 5, ARRAY['test_user_4']),
    ('cheshbon', 'feature', 'Add recurring transaction support', 'test_user_1', 'TestUser', 9, ARRAY['test_user_1']),
    ('cheshbon', 'bug', 'Balance doesn''t update after adding transaction', 'test_user_5', 'Accountant', 4, ARRAY['test_user_5'])
ON CONFLICT DO NOTHING;


-- 4. FUNCTION TO INCREMENT VOTES (Optional - for atomic updates)
-- =====================================================

CREATE OR REPLACE FUNCTION increment_request_votes(request_id UUID, voter_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE app_requests
    SET
        votes = votes + 1,
        voted_by = array_append(voted_by, voter_id),
        updated_at = NOW()
    WHERE id = request_id
    AND NOT (voter_id = ANY(voted_by));
END;
$$ LANGUAGE plpgsql;


-- 5. VIEW FOR APP STATS (Optional - useful for dashboards)
-- =====================================================

CREATE OR REPLACE VIEW app_request_stats AS
SELECT
    app_slug,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE type = 'feature') as feature_count,
    COUNT(*) FILTER (WHERE type = 'bug') as bug_count,
    COUNT(*) FILTER (WHERE status = 'open') as open_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    SUM(votes) as total_votes
FROM app_requests
GROUP BY app_slug;


-- 6. APP BUILD REQUESTS TABLE
-- Stores white-label app requests from businesses
-- =====================================================

CREATE TABLE IF NOT EXISTS app_build_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    telegram TEXT NOT NULL,
    business_type TEXT NOT NULL,
    complexity INTEGER NOT NULL CHECK (complexity >= 1 AND complexity <= 5),
    deployment_type TEXT DEFAULT 'suite_shell' CHECK (deployment_type IN ('suite_shell', 'private')),
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'in_progress', 'completed', 'declined')),
    admin_notes TEXT,
    quoted_price DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE app_build_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (submit request)
DROP POLICY IF EXISTS "Anyone can insert app_build_requests" ON app_build_requests;
CREATE POLICY "Anyone can insert app_build_requests" ON app_build_requests
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can read (for admin dashboard - secure with auth later)
DROP POLICY IF EXISTS "Anyone can read app_build_requests" ON app_build_requests;
CREATE POLICY "Anyone can read app_build_requests" ON app_build_requests
    FOR SELECT USING (true);

-- Policy: Anyone can update (for admin status changes - secure with auth later)
DROP POLICY IF EXISTS "Anyone can update app_build_requests" ON app_build_requests;
CREATE POLICY "Anyone can update app_build_requests" ON app_build_requests
    FOR UPDATE USING (true);


-- 7. INFLUENCER WAITLIST TABLE
-- Stores emails of people wanting to be influencer partners
-- =====================================================

CREATE TABLE IF NOT EXISTS influencer_waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE influencer_waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (signup)
DROP POLICY IF EXISTS "Anyone can insert influencer_waitlist" ON influencer_waitlist;
CREATE POLICY "Anyone can insert influencer_waitlist" ON influencer_waitlist
    FOR INSERT WITH CHECK (true);

-- Policy: Anyone can read (for admin dashboard - secure with auth later)
DROP POLICY IF EXISTS "Anyone can read influencer_waitlist" ON influencer_waitlist;
CREATE POLICY "Anyone can read influencer_waitlist" ON influencer_waitlist
    FOR SELECT USING (true);


-- =====================================================
-- DONE! Your SUITE Shell should now work with:
-- - Feature requests with voting
-- - Bug reports with voting
-- - App funding progress tracking
-- - Emoji icons for apps
-- - Influencer waitlist signups
-- =====================================================
