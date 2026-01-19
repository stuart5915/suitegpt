-- ═══════════════════════════════════════════════════════════════
-- SUITE Content Publishing Queue
-- ═══════════════════════════════════════════════════════════════

-- Content queue table - stores articles/ideas waiting to be published
CREATE TABLE IF NOT EXISTS content_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Content details
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT[] DEFAULT '{}',

    -- Source tracking (where did this come from?)
    source TEXT DEFAULT 'manual',  -- 'telegram', 'factory', 'manual'
    source_message_id TEXT,        -- Original Telegram message ID if applicable

    -- Publishing destination
    destination TEXT DEFAULT 'learn',  -- 'learn', 'docs', 'blog'

    -- Status workflow
    status TEXT DEFAULT 'pending',  -- 'pending', 'approved', 'processing', 'published', 'failed'

    -- Generated content (filled by Claude)
    slug TEXT,
    cover_image_url TEXT,
    published_url TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    approved_by TEXT,
    error_message TEXT
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue(status);
CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue(created_at DESC);

-- Function to approve content
CREATE OR REPLACE FUNCTION approve_content(content_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE content_queue
    SET status = 'approved', approved_at = NOW()
    WHERE id = content_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- Function to mark as published
CREATE OR REPLACE FUNCTION mark_published(content_id UUID, url TEXT, image_url TEXT, content_slug TEXT)
RETURNS void AS $$
BEGIN
    UPDATE content_queue
    SET status = 'published',
        published_at = NOW(),
        published_url = url,
        cover_image_url = image_url,
        slug = content_slug
    WHERE id = content_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════
-- Example: Insert test content
-- ═══════════════════════════════════════════════════════════════
-- INSERT INTO content_queue (title, content, tags, source)
-- VALUES (
--     'How the AI Fleet Works',
--     'The AI Fleet is a collection of autonomous agents that build apps 24/7...',
--     ARRAY['ai', 'apps', 'defi'],
--     'telegram'
-- );
