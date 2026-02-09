-- Inclawbate Ops Dashboard — Database Setup
-- Run this in Supabase SQL Editor

-- 1. Token brand configuration (per token, per deployer)
CREATE TABLE IF NOT EXISTS token_brand_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address  text NOT NULL,
  token_address   text NOT NULL,
  token_symbol    text NOT NULL,
  token_name      text,
  tone            text DEFAULT 'playful and memetic',
  topics_focus    jsonb DEFAULT '[]'::jsonb,
  topics_avoid    jsonb DEFAULT '[]'::jsonb,
  sample_posts    jsonb DEFAULT '[]'::jsonb,
  hashtags        jsonb DEFAULT '[]'::jsonb,
  posting_frequency text DEFAULT 'moderate',
  autonomy_mode   text DEFAULT 'review',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(wallet_address, token_address)
);

-- 2. Extend scheduled_posts with ops columns
ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS token_address text,
  ADD COLUMN IF NOT EXISTS wallet_address text,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text;
