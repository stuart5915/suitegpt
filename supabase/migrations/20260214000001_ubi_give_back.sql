-- UBI Give Back: Philanthropy orgs table + voluntary redirect for all stakers

-- Philanthropy orgs table
CREATE TABLE IF NOT EXISTS inclawbate_philanthropy_orgs (
    id serial PRIMARY KEY,
    name text NOT NULL,
    description text,
    wallet_address text NOT NULL,
    image_url text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Seed E3 Ministry
INSERT INTO inclawbate_philanthropy_orgs (name, description, wallet_address)
VALUES ('E3 Ministry', 'Community ministry and outreach', '0xb0680cb1a166ddad2ba5b5b9da04677a0e440a75');

-- Add org selection column to human_profiles
ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS ubi_redirect_org_id integer REFERENCES inclawbate_philanthropy_orgs(id);

-- Disable cap (set to 100%)
UPDATE inclawbate_ubi_treasury SET wallet_cap_pct = 100 WHERE id = 1;
