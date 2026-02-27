-- Inclawbator: registry of launched tokens + distribution tracking

-- inclawbator_projects: every token launched through the Inclawbator
CREATE TABLE inclawbator_projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    creator_wallet text NOT NULL,
    creator_profile_id uuid REFERENCES human_profiles(id),
    token_address text UNIQUE,
    token_name text NOT NULL,
    token_symbol text NOT NULL,
    deploy_tx_hash text UNIQUE,
    staking_address text UNIQUE,
    staking_deploy_tx text,
    description text,
    website_url text,
    x_handle text,
    telegram_url text,
    logo_url text,
    fee_split_bps integer NOT NULL DEFAULT 10000,
    tier text NOT NULL DEFAULT 'permissionless' CHECK (tier IN ('incubated','permissionless')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','rejected')),
    color text DEFAULT 'hsl(172, 32%, 48%)',
    color_dim text DEFAULT 'hsla(172, 32%, 48%, 0.12)',
    glow text DEFAULT 'hsla(172, 32%, 48%, 0.18)',
    total_fees_claimed numeric DEFAULT 0,
    total_rewards_distributed numeric DEFAULT 0,
    last_distribution_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- inclawbator_distributions: each batch reward deposit to a staking pool
CREATE TABLE inclawbator_distributions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES inclawbator_projects(id) NOT NULL,
    staking_address text NOT NULL,
    amount numeric NOT NULL,
    duration_seconds integer NOT NULL,
    tx_hash text UNIQUE NOT NULL,
    distributed_by text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inclawbator_projects_status ON inclawbator_projects(status);
CREATE INDEX idx_inclawbator_projects_creator ON inclawbator_projects(creator_wallet);
CREATE INDEX idx_inclawbator_projects_tier ON inclawbator_projects(tier);
CREATE INDEX idx_inclawbator_distributions_project ON inclawbator_distributions(project_id);
