-- Add x_refresh_token column for OAuth 2.0 project X connections
ALTER TABLE inclawbator_projects
    ADD COLUMN IF NOT EXISTS x_refresh_token text;
