-- Table to store anonymized chat import insights
-- This helps SUITE understand what users need without storing personal data

CREATE TABLE IF NOT EXISTS chat_import_insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    source TEXT NOT NULL, -- 'chatgpt', 'claude', 'gemini'
    message_count INTEGER,
    conversation_count INTEGER,
    topics TEXT[], -- Array of detected topic categories
    top_category TEXT, -- Primary interest area
    has_custom_app_need BOOLEAN DEFAULT false,
    custom_app_idea TEXT, -- Suggested custom app if no match
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_chat_insights_top_category ON chat_import_insights(top_category);
CREATE INDEX IF NOT EXISTS idx_chat_insights_created_at ON chat_import_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_insights_source ON chat_import_insights(source);

-- Enable RLS
ALTER TABLE chat_import_insights ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can insert (from edge function)
CREATE POLICY "Service role can insert insights"
    ON chat_import_insights
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Policy: Anyone can read aggregate stats (for future dashboard)
CREATE POLICY "Anyone can read insights"
    ON chat_import_insights
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Helpful view for analytics
CREATE OR REPLACE VIEW chat_import_stats AS
SELECT
    top_category,
    COUNT(*) as import_count,
    AVG(message_count) as avg_messages,
    AVG(conversation_count) as avg_conversations,
    SUM(CASE WHEN has_custom_app_need THEN 1 ELSE 0 END) as custom_app_requests
FROM chat_import_insights
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY top_category
ORDER BY import_count DESC;
