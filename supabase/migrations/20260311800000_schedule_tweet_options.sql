-- Store tweet customization options as JSON (include link, mention token, CTA, etc.)
ALTER TABLE agent_schedule ADD COLUMN IF NOT EXISTS tweet_options jsonb DEFAULT '{}';
