CREATE TABLE IF NOT EXISTS inclawbate_audits (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES human_profiles(id),
    code_hash text NOT NULL,
    language text NOT NULL,
    is_smart_contract boolean DEFAULT false,
    score integer,
    grade text,
    findings jsonb DEFAULT '[]',
    summary text,
    model_used text,
    credits_charged integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audits_profile ON inclawbate_audits(profile_id);
