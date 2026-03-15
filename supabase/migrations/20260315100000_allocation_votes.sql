-- Allocation votes: EIP-191 signed messages for treasury allocation preferences
CREATE TABLE IF NOT EXISTS allocation_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    weights JSONB NOT NULL,           -- { "reinvest": 20, "buy-claws": 25, ... }
    claws_balance NUMERIC DEFAULT 0,  -- CLAWS balance at vote time (for weighting)
    signature TEXT NOT NULL,          -- EIP-191 signature
    message TEXT NOT NULL,            -- Signed message (for verification)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One vote per wallet (upsert pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_allocation_votes_wallet ON allocation_votes (wallet_address);

-- Index for aggregation queries
CREATE INDEX IF NOT EXISTS idx_allocation_votes_updated ON allocation_votes (updated_at DESC);
