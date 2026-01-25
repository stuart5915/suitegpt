-- Create image_prompts table for novelty tracking
-- This table stores prompts used for AI image generation to ensure each new image is unique

CREATE TABLE IF NOT EXISTS image_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES scheduled_posts(id) ON DELETE SET NULL,
    prompt_used TEXT NOT NULL,
    visual_themes TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying of recent prompts
CREATE INDEX IF NOT EXISTS idx_image_prompts_created_at ON image_prompts(created_at DESC);

-- Create index for looking up prompts by post
CREATE INDEX IF NOT EXISTS idx_image_prompts_post_id ON image_prompts(post_id);

-- Enable Row Level Security
ALTER TABLE image_prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for API access)
CREATE POLICY "Service role full access" ON image_prompts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Policy: Authenticated users can read their own prompts (via posts they own)
CREATE POLICY "Users can view prompts for their posts" ON image_prompts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM scheduled_posts sp
            WHERE sp.id = image_prompts.post_id
            AND sp.user_id = auth.uid()
        )
    );
