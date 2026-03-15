-- Promo queue: projects pay CLAWS to get promoted on @inclawbate X account
CREATE TABLE IF NOT EXISTS promo_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_name TEXT NOT NULL,
    project_url TEXT,
    token_address TEXT,
    description TEXT,
    tier TEXT NOT NULL CHECK (tier IN ('shoutout', 'campaign', 'featured')),
    posts_remaining INTEGER NOT NULL DEFAULT 1,
    creator_wallet TEXT NOT NULL,
    payment_amount NUMERIC DEFAULT 0,
    payment_token TEXT DEFAULT 'CLAWS',
    payment_tx TEXT UNIQUE NOT NULL,
    x_handle TEXT,
    telegram_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'scheduled', 'posting', 'completed', 'rejected')),
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_queue_status ON promo_queue(status);
CREATE INDEX IF NOT EXISTS idx_promo_queue_wallet ON promo_queue(creator_wallet);
