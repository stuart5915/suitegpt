-- Add artstu.ca destination to intake_destinations
-- Run this in Supabase SQL Editor

INSERT INTO intake_destinations (name, slug, icon, description, keywords, active, sort_order, template_questions)
VALUES
  ('artstu.ca', 'artstu', '🎨', 'Art and creative projects for artstu.ca',
   ARRAY['art', 'artstu', 'creative', 'portfolio', 'design', 'painting', 'gallery'],
   true, 2, '[]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  active = true,
  template_questions = '[]'::jsonb,
  keywords = ARRAY['art', 'artstu', 'creative', 'portfolio', 'design', 'painting', 'gallery'];
