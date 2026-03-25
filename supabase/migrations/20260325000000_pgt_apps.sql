-- Inclawbate apps to promote
CREATE TABLE IF NOT EXISTS pgt_apps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    url TEXT,
    x_handle TEXT,
    category TEXT DEFAULT 'app',
    logo_url TEXT,
    notes TEXT,
    submitted_by TEXT,
    approved BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    mentions_count INTEGER DEFAULT 0,
    last_mentioned TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pgt_apps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pgt_apps_read" ON pgt_apps FOR SELECT USING (true);
CREATE POLICY "pgt_apps_write" ON pgt_apps FOR ALL USING (true) WITH CHECK (true);
