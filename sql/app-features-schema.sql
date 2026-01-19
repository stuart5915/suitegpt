-- =====================================================
-- APP FEATURES SYSTEM
-- Shows user flows/features for each app with pricing
-- =====================================================

-- 1. APP FEATURES TABLE
-- Stores features/actions for each app
-- =====================================================

CREATE TABLE IF NOT EXISTS app_features (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id UUID REFERENCES apps(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT '✓',  -- Emoji or icon
    credits_cost DECIMAL(10, 2) DEFAULT 0,  -- 0 = free
    is_premium BOOLEAN GENERATED ALWAYS AS (credits_cost > 0) STORED,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by app
CREATE INDEX IF NOT EXISTS idx_app_features_app ON app_features(app_id);

-- Index for active features
CREATE INDEX IF NOT EXISTS idx_app_features_active ON app_features(app_id, is_active);

-- Enable Row Level Security
ALTER TABLE app_features ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read features
DROP POLICY IF EXISTS "Anyone can read app_features" ON app_features;
CREATE POLICY "Anyone can read app_features" ON app_features
    FOR SELECT USING (true);

-- Policy: Anyone can insert/update (secured via service key)
DROP POLICY IF EXISTS "Anyone can insert app_features" ON app_features;
CREATE POLICY "Anyone can insert app_features" ON app_features
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update app_features" ON app_features;
CREATE POLICY "Anyone can update app_features" ON app_features
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete app_features" ON app_features;
CREATE POLICY "Anyone can delete app_features" ON app_features
    FOR DELETE USING (true);


-- 2. VIEW: App Features Summary
-- =====================================================

CREATE OR REPLACE VIEW app_features_summary AS
SELECT
    a.id AS app_id,
    a.name AS app_name,
    a.slug,
    COUNT(af.id) AS total_features,
    COUNT(af.id) FILTER (WHERE af.credits_cost = 0) AS free_features,
    COUNT(af.id) FILTER (WHERE af.credits_cost > 0) AS paid_features,
    COALESCE(MIN(af.credits_cost) FILTER (WHERE af.credits_cost > 0), 0) AS min_credit_cost,
    COALESCE(MAX(af.credits_cost), 0) AS max_credit_cost
FROM apps a
LEFT JOIN app_features af ON a.id = af.app_id AND af.is_active = TRUE
GROUP BY a.id, a.name, a.slug;


-- 3. FUNCTION: Get App Features
-- Returns all active features for an app
-- =====================================================

CREATE OR REPLACE FUNCTION get_app_features(p_app_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    icon TEXT,
    credits_cost DECIMAL,
    is_premium BOOLEAN,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        af.id,
        af.name,
        af.description,
        af.icon,
        af.credits_cost,
        af.is_premium,
        af.sort_order
    FROM app_features af
    WHERE af.app_id = p_app_id
    AND af.is_active = TRUE
    ORDER BY af.sort_order, af.credits_cost, af.name;
END;
$$ LANGUAGE plpgsql;


-- 4. FUNCTION: Get App Features by Slug
-- =====================================================

CREATE OR REPLACE FUNCTION get_app_features_by_slug(p_slug TEXT)
RETURNS TABLE (
    id UUID,
    name TEXT,
    description TEXT,
    icon TEXT,
    credits_cost DECIMAL,
    is_premium BOOLEAN,
    sort_order INTEGER
) AS $$
DECLARE
    v_app_id UUID;
BEGIN
    SELECT apps.id INTO v_app_id FROM apps WHERE slug = p_slug;

    IF v_app_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT * FROM get_app_features(v_app_id);
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- SAMPLE DATA: FoodVitals Features
-- =====================================================

-- First, get FoodVitals app ID and insert features
DO $$
DECLARE
    v_foodvitals_id UUID;
BEGIN
    SELECT id INTO v_foodvitals_id FROM apps WHERE slug = 'foodvitals';

    IF v_foodvitals_id IS NOT NULL THEN
        -- Clear existing features for this app
        DELETE FROM app_features WHERE app_id = v_foodvitals_id;

        -- Insert features
        INSERT INTO app_features (app_id, name, description, icon, credits_cost, sort_order) VALUES
        (v_foodvitals_id, 'Scan meal photo', 'Take a photo of your meal for instant analysis', '📸', 0, 1),
        (v_foodvitals_id, 'View macro breakdown', 'See calories, protein, carbs, and fats', '📊', 0, 2),
        (v_foodvitals_id, 'AI health insights', 'Get personalized health recommendations', '🧠', 2, 3),
        (v_foodvitals_id, 'Generate meal plan', 'Weekly AI-generated meal plan based on your goals', '📅', 5, 4),
        (v_foodvitals_id, 'Allergen deep-dive', 'Detailed allergen and ingredient analysis', '🔬', 3, 5),
        (v_foodvitals_id, 'Track nutrition history', 'View your nutrition trends over time', '📈', 0, 6);
    END IF;
END $$;


-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- Get all features for an app by ID:
-- SELECT * FROM get_app_features('uuid-here');

-- Get all features for an app by slug:
-- SELECT * FROM get_app_features_by_slug('foodvitals');

-- Get features summary for all apps:
-- SELECT * FROM app_features_summary;

-- Add a new feature:
-- INSERT INTO app_features (app_id, name, description, icon, credits_cost, sort_order)
-- VALUES ('app-uuid', 'Feature Name', 'Description', '🎯', 5, 1);
