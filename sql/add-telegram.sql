-- Add Telegram chat ID for notifications
ALTER TABLE human_profiles
ADD COLUMN IF NOT EXISTS telegram_chat_id text;
