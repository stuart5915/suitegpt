-- Projects table: bundles app + token + staking + socials into one entity
DROP TABLE IF EXISTS projects;

CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_wallet text NOT NULL,
    creator_profile_id uuid,
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    description text,
    logo_url text,
    app_id uuid,
    app_slug text,
    token_address text,
    staking_address text,
    x_handle text,
    telegram_url text,
    website_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_projects_creator ON projects(creator_wallet);
