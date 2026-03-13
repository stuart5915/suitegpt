-- Crash game: deposit/withdrawal tracking + persistent balances

CREATE TABLE IF NOT EXISTS crash_balances (
    wallet TEXT PRIMARY KEY,
    chips BIGINT NOT NULL DEFAULT 0,
    username TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crash_deposits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tx_hash TEXT UNIQUE NOT NULL,
    wallet TEXT NOT NULL,
    claws_amount NUMERIC NOT NULL,
    chips_credited BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crash_withdrawals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tx_hash TEXT,
    wallet TEXT NOT NULL,
    chips BIGINT NOT NULL,
    claws_amount NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crash_deposits_wallet ON crash_deposits(wallet);
CREATE INDEX IF NOT EXISTS idx_crash_withdrawals_wallet ON crash_withdrawals(wallet);
