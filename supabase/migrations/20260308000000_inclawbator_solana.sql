-- Add multi-chain support to inclawbator_projects
ALTER TABLE inclawbator_projects
    ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'base',
    ADD COLUMN IF NOT EXISTS solana_wallet text,
    ADD COLUMN IF NOT EXISTS solana_token_mint text;

CREATE INDEX IF NOT EXISTS idx_inclawbator_projects_chain ON inclawbator_projects(chain);
