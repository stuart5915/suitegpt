-- Hire Requests — direct hire flow from inclawbators directory
-- Someone clicks "Hire" on a profile → fills form → saved here + TG notification

CREATE TABLE IF NOT EXISTS hire_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Target inclawbator
    target_profile_id uuid REFERENCES human_profiles(id) ON DELETE SET NULL,
    target_wallet text NOT NULL,

    -- Request details
    description text NOT NULL CHECK (char_length(description) BETWEEN 10 AND 500),
    budget_claws integer,
    requester_contact text NOT NULL CHECK (char_length(requester_contact) BETWEEN 2 AND 100),

    -- Status: pending → accepted/declined/expired
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_hire_requests_target ON hire_requests(target_wallet);
CREATE INDEX IF NOT EXISTS idx_hire_requests_status ON hire_requests(status);
CREATE INDEX IF NOT EXISTS idx_hire_requests_created ON hire_requests(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_hire_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hire_requests_updated ON hire_requests;
CREATE TRIGGER trg_hire_requests_updated
    BEFORE UPDATE ON hire_requests
    FOR EACH ROW EXECUTE FUNCTION update_hire_request_updated_at();

-- RLS: service role only (API handles access control)
ALTER TABLE hire_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON hire_requests
    FOR ALL USING (true) WITH CHECK (true);
