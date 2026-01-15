-- Migration: Make highlights publicly readable on profile pages
-- This allows anyone to SEE another user's highlights on their profile
-- but does NOT affect the Bible view (users still only see their own highlights there)

-- Add a policy that allows anyone to read any user's highlights
-- This is for the profile page "Highlights" tab
DROP POLICY IF EXISTS "Anyone can view highlights for profiles" ON verse_highlights;

CREATE POLICY "Anyone can view highlights for profiles"
  ON verse_highlights FOR SELECT
  USING (true);  -- Allow all authenticated/anonymous users to read

-- Note: The existing write policies remain unchanged:
-- - Users can only INSERT their own highlights
-- - Users can only UPDATE their own highlights  
-- - Users can only DELETE their own highlights
