-- Add bid column for @inclawbator slot priority
-- Higher bid = posts first on the shared account. Base cost still applies on top.
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS agent_bid integer DEFAULT 0;
