-- Inclawbator Gigs — freelance marketplace
-- Hirers post gig requests, inclawbators claim and complete them

CREATE TABLE IF NOT EXISTS inclawbator_gigs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Hirer (who posted the gig)
    hirer_id uuid REFERENCES human_profiles(id) ON DELETE SET NULL,
    hirer_wallet text,
    hirer_handle text,

    -- Gig details
    description text NOT NULL CHECK (char_length(description) >= 10 AND char_length(description) <= 500),
    category text NOT NULL CHECK (category IN ('design', 'dev', 'marketing', 'content', 'strategy', 'other')),
    budget_claws integer NOT NULL CHECK (budget_claws >= 100 AND budget_claws <= 1000000),
    timeline text NOT NULL CHECK (timeline IN ('asap', 'week', 'norush')),

    -- Status
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'delivered', 'completed', 'cancelled', 'disputed')),

    -- Claimer (inclawbator who accepted)
    claimed_by_id uuid REFERENCES human_profiles(id) ON DELETE SET NULL,
    claimed_by_wallet text,
    claimed_by_handle text,
    claimed_at timestamptz,

    -- Completion
    completed_at timestamptz,

    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_gigs_status ON inclawbator_gigs(status);
CREATE INDEX idx_gigs_hirer ON inclawbator_gigs(hirer_id);
CREATE INDEX idx_gigs_claimer ON inclawbator_gigs(claimed_by_id);
CREATE INDEX idx_gigs_category ON inclawbator_gigs(category);
CREATE INDEX idx_gigs_created ON inclawbator_gigs(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_gig_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gig_updated_at_trigger
    BEFORE UPDATE ON inclawbator_gigs
    FOR EACH ROW
    EXECUTE FUNCTION update_gig_updated_at();

-- Helper: increment hire_count on profile when gig completed
CREATE OR REPLACE FUNCTION increment_hire_count(profile_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE human_profiles
    SET hire_count = COALESCE(hire_count, 0) + 1
    WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql;

-- RLS: anyone can read gigs, only authenticated users can insert/update
ALTER TABLE inclawbator_gigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read gigs" ON inclawbator_gigs
    FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON inclawbator_gigs
    FOR ALL USING (true) WITH CHECK (true);
