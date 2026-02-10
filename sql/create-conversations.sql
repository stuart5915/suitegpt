-- Inclawbate Conversations & Messages
-- Agents hire humans via CLAWNCH payment, which opens a conversation channel

-- ── Conversations ──
CREATE TABLE IF NOT EXISTS inclawbate_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    human_id uuid NOT NULL REFERENCES human_profiles(id) ON DELETE CASCADE,
    agent_address text,              -- agent's wallet address (on-chain identity)
    agent_name text,                 -- display name (optional, set by agent)
    payment_amount numeric DEFAULT 0,-- CLAWNCH paid to open this conversation
    payment_tx text,                 -- transaction hash on Base
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    last_message_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_conversations_human ON inclawbate_conversations(human_id);
CREATE INDEX idx_conversations_agent ON inclawbate_conversations(agent_address);
CREATE INDEX idx_conversations_status ON inclawbate_conversations(status);
CREATE INDEX idx_conversations_last_msg ON inclawbate_conversations(last_message_at DESC);

-- ── Messages ──
CREATE TABLE IF NOT EXISTS inclawbate_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL REFERENCES inclawbate_conversations(id) ON DELETE CASCADE,
    sender_type text NOT NULL CHECK (sender_type IN ('agent', 'human')),
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON inclawbate_messages(conversation_id, created_at);

-- ── Auto-update last_message_at on new message ──
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inclawbate_conversations
    SET last_message_at = NEW.created_at, updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_last_message
    AFTER INSERT ON inclawbate_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();
