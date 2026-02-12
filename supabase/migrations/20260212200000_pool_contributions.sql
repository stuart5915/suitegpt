-- Track community contributions to the weekly reward pool
CREATE TABLE inclawbate_pool_contributions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address text NOT NULL,
    x_handle text,
    x_name text,
    tx_hash text UNIQUE NOT NULL,
    clawnch_amount numeric NOT NULL,
    week_ends_at timestamptz,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_pool_contrib_wallet ON inclawbate_pool_contributions(wallet_address);
CREATE INDEX idx_pool_contrib_week ON inclawbate_pool_contributions(week_ends_at);
