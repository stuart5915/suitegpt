-- Allow Kingdom allocation to target individual requests (GCM or UBI)
ALTER TABLE human_profiles
    ADD COLUMN IF NOT EXISTS ubi_redirect_request_id integer;
