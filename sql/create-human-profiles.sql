-- Inclawbate — Human Profiles table
-- Run this in Supabase SQL editor

CREATE TABLE human_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  x_handle text UNIQUE NOT NULL,
  x_id text UNIQUE NOT NULL,
  x_name text,
  x_avatar_url text,
  x_access_token text,
  x_refresh_token text,
  bio text,
  tagline text,
  services jsonb DEFAULT '[]',
  skills text[] DEFAULT '{}',
  wallet_address text,
  creative_freedom text DEFAULT 'full',
  availability text DEFAULT 'available',
  contact_preference text DEFAULT 'x_dm',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_human_profiles_skills ON human_profiles USING gin(skills);
CREATE INDEX idx_human_profiles_availability ON human_profiles(availability);
CREATE INDEX idx_human_profiles_x_handle ON human_profiles(x_handle);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_human_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER human_profiles_updated_at
  BEFORE UPDATE ON human_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_human_profiles_updated_at();
