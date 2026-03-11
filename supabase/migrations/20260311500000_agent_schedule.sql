-- Schedule-based posting for @inclawbator shared account
-- Users book time slots on a calendar, each slot = 1 tweet

CREATE TABLE IF NOT EXISTS agent_schedule (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    booked_by_wallet text NOT NULL,
    scheduled_at timestamptz NOT NULL,
    content_angle text,           -- what the tweet should focus on
    tone text DEFAULT 'default',  -- hype, chill, degen, professional, meme
    catchphrase text,
    status text DEFAULT 'scheduled', -- scheduled, posted, failed, cancelled
    tweet_text text,              -- filled after generation
    tweet_id text,                -- filled after posting to X
    credits_cost integer DEFAULT 10,
    created_at timestamptz DEFAULT now()
);

-- Only one scheduled slot per time (cancelled slots don't block)
CREATE UNIQUE INDEX idx_schedule_unique_slot
    ON agent_schedule(scheduled_at) WHERE status = 'scheduled';

CREATE INDEX idx_schedule_status ON agent_schedule(status, scheduled_at);
CREATE INDEX idx_schedule_project ON agent_schedule(project_id);
CREATE INDEX idx_schedule_wallet ON agent_schedule(booked_by_wallet);
