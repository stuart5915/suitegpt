-- UBI Treasury config (singleton row like inclawbate_rewards)
CREATE TABLE inclawbate_ubi_treasury (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    total_balance numeric NOT NULL DEFAULT 0,
    total_distributed numeric NOT NULL DEFAULT 0,
    distribution_count integer NOT NULL DEFAULT 0,
    verified_humans integer NOT NULL DEFAULT 0,
    weekly_rate numeric NOT NULL DEFAULT 0,
    last_distribution_at timestamptz,
    updated_at timestamptz DEFAULT now()
);
INSERT INTO inclawbate_ubi_treasury (id) VALUES (1);

-- UBI fund contributions
CREATE TABLE inclawbate_ubi_contributions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address text NOT NULL,
    x_handle text,
    x_name text,
    tx_hash text UNIQUE NOT NULL,
    clawnch_amount numeric NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ubi_contrib_wallet ON inclawbate_ubi_contributions(wallet_address);
CREATE INDEX idx_ubi_contrib_created ON inclawbate_ubi_contributions(created_at DESC);
