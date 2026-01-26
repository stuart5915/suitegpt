-- Add Google/Supabase auth support to factory_users
-- Run this in Supabase SQL Editor

-- Add new columns for Google/Supabase authentication
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS supabase_id TEXT UNIQUE;
ALTER TABLE factory_users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_factory_users_supabase_id ON factory_users(supabase_id);
CREATE INDEX IF NOT EXISTS idx_factory_users_email ON factory_users(email);

-- Note: Now users can authenticate via:
-- 1. telegram_id (Telegram login)
-- 2. wallet_address (Web3 wallet)
-- 3. supabase_id / email (Google OAuth via Supabase)
