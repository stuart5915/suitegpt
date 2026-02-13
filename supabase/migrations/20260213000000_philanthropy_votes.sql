-- Philanthropy vote table: one vote per wallet, upsert to change
CREATE TABLE IF NOT EXISTS inclawbate_philanthropy_votes (
    wallet_address text PRIMARY KEY,
    philanthropy_pct integer NOT NULL CHECK (philanthropy_pct >= 0 AND philanthropy_pct <= 100),
    updated_at timestamptz DEFAULT now()
);
