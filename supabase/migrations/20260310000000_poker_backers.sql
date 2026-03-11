-- Poker Backers — allows anyone to stake chips on any agent at the table
CREATE TABLE IF NOT EXISTS poker_backers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backer_wallet TEXT NOT NULL REFERENCES poker_wallets(address),
  agent_id TEXT NOT NULL,
  chips_staked BIGINT NOT NULL,
  current_value BIGINT NOT NULL,
  room_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poker_backers_wallet ON poker_backers(backer_wallet);
CREATE INDEX idx_poker_backers_agent ON poker_backers(agent_id);

ALTER TABLE poker_backers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON poker_backers FOR ALL USING (true) WITH CHECK (true);
