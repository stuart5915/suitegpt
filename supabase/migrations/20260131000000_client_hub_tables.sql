-- =============================================
-- Client Hub: Leads & Ads Tracking
-- =============================================

-- Ads table (create first since leads references it)
CREATE TABLE IF NOT EXISTS client_ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    url TEXT,
    budget DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'active',
    leads_count INT DEFAULT 0,
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_ad_status CHECK (status IN ('draft', 'active', 'paused', 'expired'))
);

-- Leads table
CREATE TABLE IF NOT EXISTS client_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    business_name TEXT,
    business_type TEXT,
    what_they_need TEXT,
    source TEXT,
    ad_id UUID REFERENCES client_ads(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'new',
    monthly_rate DECIMAL(10,2) DEFAULT 0,
    trial_start DATE,
    trial_end DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_lead_status CHECK (status IN ('new', 'contacted', 'trial', 'active', 'churned'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_leads_status ON client_leads(status);
CREATE INDEX IF NOT EXISTS idx_client_leads_source ON client_leads(source);
CREATE INDEX IF NOT EXISTS idx_client_leads_created ON client_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_ads_status ON client_ads(status);

-- RLS
ALTER TABLE client_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ads ENABLE ROW LEVEL SECURITY;

-- Leads: anon can insert (landing page form) and select (dashboard reads)
DO $$ BEGIN
    CREATE POLICY "anon_insert_leads" ON client_leads FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_select_leads" ON client_leads FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_update_leads" ON client_leads FOR UPDATE TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ads: anon can read and manage
DO $$ BEGIN
    CREATE POLICY "anon_select_ads" ON client_ads FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_insert_ads" ON client_ads FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "anon_update_ads" ON client_ads FOR UPDATE TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Service role full access
DO $$ BEGIN
    CREATE POLICY "service_all_leads" ON client_leads FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "service_all_ads" ON client_ads FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
