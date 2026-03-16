-- Poker hand history for agent stats + self-learning
CREATE TABLE IF NOT EXISTS poker_hand_history (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  room_id TEXT,
  hand_number BIGINT,
  cards TEXT[],
  community TEXT[],
  hand_name TEXT,
  result TEXT,
  delta INTEGER,
  chips_bet INTEGER,
  stack_after INTEGER,
  fold_phase TEXT,
  opponent_hand TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hand_history_agent ON poker_hand_history(agent_id);
CREATE INDEX idx_hand_history_wallet ON poker_hand_history(wallet_address);
CREATE INDEX idx_hand_history_created ON poker_hand_history(created_at);

-- Learned traits for self-learning engine
ALTER TABLE poker_agents ADD COLUMN IF NOT EXISTS learned_traits JSONB DEFAULT '{}';
