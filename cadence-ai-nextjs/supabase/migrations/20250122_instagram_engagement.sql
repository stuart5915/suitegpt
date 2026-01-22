-- ================================
-- INSTAGRAM ENGAGEMENT TABLES
-- Run this in Supabase SQL Editor
-- ================================

-- ================================
-- INSTAGRAM ENGAGEMENT HISTORY
-- ================================
CREATE TABLE IF NOT EXISTS instagram_engagement (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT NOT NULL,
  project_id UUID REFERENCES projects(id),
  post_url TEXT NOT NULL,
  post_author TEXT,
  post_caption TEXT,
  comment_text TEXT,
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'copied', 'posted', 'skipped')),
  skip_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_instagram_engagement_telegram_id ON instagram_engagement(telegram_id);
CREATE INDEX IF NOT EXISTS idx_instagram_engagement_created_at ON instagram_engagement(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_instagram_engagement_status ON instagram_engagement(status);

-- ================================
-- INSTAGRAM ENGAGEMENT CONFIG
-- ================================
CREATE TABLE IF NOT EXISTS instagram_engagement_config (
  telegram_id TEXT PRIMARY KEY,
  hashtags TEXT[] DEFAULT '{}',
  target_accounts TEXT[] DEFAULT '{}',
  min_followers INTEGER DEFAULT 1000,
  max_followers INTEGER DEFAULT 100000,
  max_age_hours INTEGER DEFAULT 48,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER update_instagram_engagement_config_updated_at
  BEFORE UPDATE ON instagram_engagement_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- CREDITS TRANSACTIONS (if not exists)
-- For tracking AI usage across Cadence
-- ================================
CREATE TABLE IF NOT EXISTS cadence_credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT NOT NULL,
  wallet_address TEXT,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ai_usage', 'purchase', 'bonus', 'refund')),
  feature TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cadence_credit_transactions_telegram_id ON cadence_credit_transactions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_cadence_credit_transactions_wallet ON cadence_credit_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_cadence_credit_transactions_created_at ON cadence_credit_transactions(created_at DESC);

-- ================================
-- CADENCE WALLET LINKS
-- Links Telegram accounts to SUITE wallets
-- ================================
CREATE TABLE IF NOT EXISTS cadence_wallet_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id TEXT UNIQUE,
  wallet_address TEXT NOT NULL UNIQUE,
  linked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cadence_wallet_links_telegram_id ON cadence_wallet_links(telegram_id);
CREATE INDEX IF NOT EXISTS idx_cadence_wallet_links_wallet ON cadence_wallet_links(wallet_address);
