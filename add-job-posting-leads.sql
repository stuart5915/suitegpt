-- Job Posting Leads Table
-- Run this in your Supabase SQL Editor

-- Leads collected from job posting sources
CREATE TABLE IF NOT EXISTS job_posting_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_posting_id UUID NOT NULL REFERENCES job_board_postings(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact TEXT, -- email, telegram handle, phone, etc.
    contact_type TEXT DEFAULT 'email', -- 'email', 'telegram', 'phone', 'linkedin', 'other'
    notes TEXT,
    added_to_pipeline BOOLEAN DEFAULT false,
    pipeline_application_id UUID, -- links to app_operator_applications if added
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update job_board_postings to add refresh tracking
ALTER TABLE job_board_postings
    ADD COLUMN IF NOT EXISTS refresh_interval_days INTEGER DEFAULT 14,
    ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Enable RLS
ALTER TABLE job_posting_leads ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can read leads" ON job_posting_leads FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leads" ON job_posting_leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update leads" ON job_posting_leads FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete leads" ON job_posting_leads FOR DELETE USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_posting_leads_posting ON job_posting_leads(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_job_posting_leads_pipeline ON job_posting_leads(added_to_pipeline);

-- Grant access
GRANT ALL ON job_posting_leads TO anon, authenticated;
