-- Fix RLS policy for user_profiles to allow upsert
-- Run this in Supabase SQL Editor

-- Allow users to INSERT their own profile row
CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own profile row  
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to SELECT their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

-- Allow public to view profiles (for community features)
CREATE POLICY "Public can view all profiles" ON user_profiles
    FOR SELECT TO anon, authenticated
    USING (true);
