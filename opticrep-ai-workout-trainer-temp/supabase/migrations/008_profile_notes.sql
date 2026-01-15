-- Add current_weight and user_notes columns to profiles table
-- For persisting user data across app reloads

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_weight DECIMAL(5,2);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_notes TEXT[] DEFAULT '{}';
