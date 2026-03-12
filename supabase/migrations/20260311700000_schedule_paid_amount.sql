-- Track how much CLAWS was paid per slot (for takeover bidding)
ALTER TABLE agent_schedule ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
