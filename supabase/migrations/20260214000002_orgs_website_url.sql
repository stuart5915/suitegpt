-- Add website_url to philanthropy orgs for ministry links
ALTER TABLE inclawbate_philanthropy_orgs
    ADD COLUMN IF NOT EXISTS website_url text;

-- Set E3 Ministry website
UPDATE inclawbate_philanthropy_orgs
    SET website_url = 'https://e3ministry.ca/'
    WHERE name = 'E3 Ministry';
