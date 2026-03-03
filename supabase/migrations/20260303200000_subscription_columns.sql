-- Add monthly subscription columns to human_profiles
ALTER TABLE human_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id          text UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_tier           text,
  ADD COLUMN IF NOT EXISTS subscription_status         text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id      text UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end  timestamptz;
