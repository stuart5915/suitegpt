-- Add separate columns for template, AI background, and combined images
-- This allows independent generation and combination of image components

ALTER TABLE scheduled_posts
ADD COLUMN IF NOT EXISTS template_image_url TEXT,
ADD COLUMN IF NOT EXISTS ai_background_url TEXT,
ADD COLUMN IF NOT EXISTS combined_image_url TEXT;

-- Add comment explaining the new columns
COMMENT ON COLUMN scheduled_posts.template_image_url IS 'URL of the branded template image (no AI background)';
COMMENT ON COLUMN scheduled_posts.ai_background_url IS 'URL of the raw AI-generated background image from Gemini';
COMMENT ON COLUMN scheduled_posts.combined_image_url IS 'URL of the final combined image (template + AI background)';
