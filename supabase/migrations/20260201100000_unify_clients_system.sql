-- =============================================
-- Unify Clients System
-- Extend suite_operators to support both operator (salary)
-- and local-business (monthly fee) client types
-- =============================================

-- Add new columns for unified client management
ALTER TABLE suite_operators
    ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'salary',
    ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS business_type TEXT,
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS trial_start DATE,
    ADD COLUMN IF NOT EXISTS trial_end DATE,
    ADD COLUMN IF NOT EXISTS converted_from_lead_id UUID;

-- Update status constraint to unified set
-- Drop old constraint if it exists (safe to ignore errors)
DO $$ BEGIN
    ALTER TABLE suite_operators DROP CONSTRAINT IF EXISTS suite_operators_status_check;
    ALTER TABLE suite_operators DROP CONSTRAINT IF EXISTS valid_operator_status;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE suite_operators
    ADD CONSTRAINT valid_client_status
    CHECK (status IN ('lead', 'trial', 'active', 'paused', 'completed', 'churned'));

-- Add constraint for payment_type
DO $$ BEGIN
    ALTER TABLE suite_operators
        ADD CONSTRAINT valid_payment_type
        CHECK (payment_type IN ('monthly', 'salary'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suite_operators_payment_type ON suite_operators(payment_type);
CREATE INDEX IF NOT EXISTS idx_suite_operators_source ON suite_operators(source);
