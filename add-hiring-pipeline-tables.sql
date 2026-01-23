-- SUITE Hiring Pipeline & Onboarding Tables
-- Run this in your Supabase SQL Editor

-- =============================================
-- PIPELINE STAGES
-- =============================================

-- Pipeline stage definitions (configurable)
CREATE TABLE IF NOT EXISTS hiring_pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#6b7280', -- hex color for UI
    auto_advance_days INTEGER, -- auto-move to next stage after X days (null = manual)
    email_template_id UUID, -- template to send when entering this stage
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pipeline stages
INSERT INTO hiring_pipeline_stages (name, slug, description, order_index, color) VALUES
    ('Applied', 'applied', 'New application received', 0, '#f59e0b'),
    ('Screening', 'screening', 'Initial review of application', 1, '#3b82f6'),
    ('Interview', 'interview', 'Scheduled or completed interview', 2, '#8b5cf6'),
    ('Offer', 'offer', 'Offer extended, awaiting response', 3, '#ec4899'),
    ('Onboarding', 'onboarding', 'Accepted, going through onboarding', 4, '#10b981'),
    ('Active', 'active', 'Fully onboarded and operating', 5, '#22c55e'),
    ('Rejected', 'rejected', 'Application rejected', 99, '#ef4444'),
    ('Withdrawn', 'withdrawn', 'Candidate withdrew', 98, '#6b7280')
ON CONFLICT (slug) DO NOTHING;

-- Application pipeline tracking (extends app_operator_applications)
-- Add columns to existing table
ALTER TABLE app_operator_applications
    ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'applied',
    ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS assigned_reviewer TEXT,
    ADD COLUMN IF NOT EXISTS interview_scheduled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS interview_notes TEXT,
    ADD COLUMN IF NOT EXISTS offer_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS offer_response TEXT, -- 'accepted', 'declined', 'negotiating'
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS source_campaign TEXT; -- which Cadence loop/job posting brought them

-- Pipeline stage history (audit trail)
CREATE TABLE IF NOT EXISTS application_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    changed_by TEXT, -- admin who made the change
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ONBOARDING CHECKLISTS
-- =============================================

-- Onboarding checklist templates
CREATE TABLE IF NOT EXISTS onboarding_checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    items JSONB NOT NULL DEFAULT '[]', -- array of {title, description, order, required}
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default onboarding checklist
INSERT INTO onboarding_checklist_templates (name, description, is_default, items) VALUES
(
    'App Operator Onboarding',
    'Standard onboarding checklist for new app operators',
    true,
    '[
        {"order": 1, "title": "Connect Telegram or Wallet", "description": "Ensure your account is connected for communication and payments", "required": true},
        {"order": 2, "title": "Watch orientation video", "description": "5-minute overview of how SUITE works", "required": true},
        {"order": 3, "title": "Review your app", "description": "Explore your assigned app and understand its features", "required": true},
        {"order": 4, "title": "Set up Cadence AI", "description": "Configure your first marketing campaign", "required": true},
        {"order": 5, "title": "Join the community", "description": "Introduce yourself in the operator community", "required": false},
        {"order": 6, "title": "Create first content", "description": "Draft your first social media post using Cadence", "required": true},
        {"order": 7, "title": "Review analytics dashboard", "description": "Understand how to track your app performance", "required": true},
        {"order": 8, "title": "Submit a feature request", "description": "Use Factory to request an improvement for your app", "required": false}
    ]'
)
ON CONFLICT DO NOTHING;

-- Individual operator onboarding progress
CREATE TABLE IF NOT EXISTS operator_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID NOT NULL,
    application_id UUID,
    checklist_template_id UUID,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    progress JSONB DEFAULT '{}', -- {item_id: {completed: bool, completed_at: timestamp, notes: string}}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- EMAIL TEMPLATES (for pipeline automation)
-- =============================================

CREATE TABLE IF NOT EXISTS hiring_email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL, -- supports {{variables}}
    stage_trigger TEXT, -- which pipeline stage triggers this
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default email templates
INSERT INTO hiring_email_templates (name, slug, subject, body, stage_trigger) VALUES
(
    'Application Received',
    'application-received',
    'We received your SUITE application!',
    'Hi {{name}},

Thanks for applying to become an App Operator at SUITE! We''ve received your application for {{app_name}}.

We review applications daily and will get back to you within a few days.

In the meantime, feel free to explore our apps at getsuite.app

Best,
The SUITE Team',
    'applied'
),
(
    'Moving to Interview',
    'interview-invite',
    'Next steps for your SUITE application',
    'Hi {{name}},

Great news! We''d like to learn more about you and discuss the {{app_name}} opportunity.

Please reply to this email with your availability for a quick 15-minute call this week.

Looking forward to chatting!

Best,
The SUITE Team',
    'interview'
),
(
    'Offer Extended',
    'offer-extended',
    'Welcome to SUITE - Your App Operator Offer',
    'Hi {{name}},

We''re excited to offer you the App Operator position for {{app_name}}!

Here''s what you''ll get:
- 90% revenue share
- 10,000 SUITE credits/month for marketing
- Access to Cadence AI and all operator tools

To accept, simply reply to this email and we''ll get you started with onboarding.

Welcome to the team!

Best,
The SUITE Team',
    'offer'
),
(
    'Onboarding Started',
    'onboarding-welcome',
    'Let''s get you started with {{app_name}}',
    'Hi {{name}},

Welcome aboard! You''re now the official operator of {{app_name}}.

Here''s how to get started:
1. Log in at getsuite.app/profile
2. Complete your onboarding checklist
3. Set up your first Cadence AI campaign

Your onboarding checklist is ready and waiting. Complete it to unlock your full operator dashboard.

Questions? Just reply to this email.

Let''s build something great!

Best,
The SUITE Team',
    'onboarding'
)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- INDEXES & POLICIES
-- =============================================

-- Indexes
CREATE INDEX IF NOT EXISTS idx_app_stage_history_app ON application_stage_history(application_id);
CREATE INDEX IF NOT EXISTS idx_app_pipeline_stage ON app_operator_applications(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_operator_onboarding_operator ON operator_onboarding(operator_id);

-- Enable RLS
ALTER TABLE hiring_pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE hiring_email_templates ENABLE ROW LEVEL SECURITY;

-- Policies (open for now, tighten in production)
CREATE POLICY "Anyone can read pipeline stages" ON hiring_pipeline_stages FOR SELECT USING (true);
CREATE POLICY "Anyone can read stage history" ON application_stage_history FOR SELECT USING (true);
CREATE POLICY "Anyone can insert stage history" ON application_stage_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read checklist templates" ON onboarding_checklist_templates FOR SELECT USING (true);
CREATE POLICY "Anyone can read onboarding" ON operator_onboarding FOR SELECT USING (true);
CREATE POLICY "Anyone can insert onboarding" ON operator_onboarding FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update onboarding" ON operator_onboarding FOR UPDATE USING (true);
CREATE POLICY "Anyone can read email templates" ON hiring_email_templates FOR SELECT USING (true);

-- Grants
GRANT ALL ON hiring_pipeline_stages TO anon, authenticated;
GRANT ALL ON application_stage_history TO anon, authenticated;
GRANT ALL ON onboarding_checklist_templates TO anon, authenticated;
GRANT ALL ON operator_onboarding TO anon, authenticated;
GRANT ALL ON hiring_email_templates TO anon, authenticated;
