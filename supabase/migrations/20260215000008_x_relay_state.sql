-- X → Telegram relay state tracking
-- Stores last_tweet_id per X account so the cron job only forwards new tweets

CREATE TABLE IF NOT EXISTS x_relay_state (
    x_handle text PRIMARY KEY,
    x_user_id text,
    last_tweet_id text,
    last_checked_at timestamptz DEFAULT now()
);

-- Seed the accounts we want to relay
INSERT INTO x_relay_state (x_handle) VALUES
    ('artstu'),
    ('inclawbate')
ON CONFLICT (x_handle) DO NOTHING;
