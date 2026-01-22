-- SUITE Apps RLS Policies
-- Add permissive policies for admin dashboard

-- Enable RLS if not already enabled
ALTER TABLE suite_apps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "apps_select_public" ON suite_apps;
DROP POLICY IF EXISTS "apps_select_visible" ON suite_apps;
DROP POLICY IF EXISTS "apps_admin_all" ON suite_apps;
DROP POLICY IF EXISTS "apps_admin_manage" ON suite_apps;

-- Allow everyone to select non-hidden apps
CREATE POLICY "apps_select_visible" ON suite_apps
    FOR SELECT USING (status != 'hidden' OR status IS NULL);

-- Allow admin full access for inserts/updates/deletes (permissive for admin dashboard)
CREATE POLICY "apps_admin_manage" ON suite_apps
    FOR ALL USING (true) WITH CHECK (true);
