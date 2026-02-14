-- Notifications for UBI request activity (comments, funding)
CREATE TABLE IF NOT EXISTS inclawbate_notifications (
    id serial PRIMARY KEY,
    wallet_address text NOT NULL,
    type text NOT NULL CHECK (type IN ('comment', 'fund')),
    request_id integer REFERENCES inclawbate_ubi_requests(id) ON DELETE CASCADE,
    from_wallet text NOT NULL,
    message text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_wallet ON inclawbate_notifications(wallet_address, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON inclawbate_notifications(created_at DESC);
