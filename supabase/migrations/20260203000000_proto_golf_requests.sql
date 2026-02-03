-- Proto Golf Site Editor Requests table
-- Stores history of AI-assisted site edits made through the admin dashboard

-- Create the table if it doesn't exist, or add missing columns if it does
CREATE TABLE IF NOT EXISTS proto_golf_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    page text,
    element_selector text,
    element_text text,
    request_text text,
    input_type text DEFAULT 'text',  -- 'text', 'voice', 'ai_applied'
    status text DEFAULT 'pending',   -- 'pending', 'published', 'failed'
    created_at timestamptz DEFAULT now()
);

-- If table already exists, add columns that might be missing
DO $$
BEGIN
    -- Add element_selector if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'proto_golf_requests' AND column_name = 'element_selector') THEN
        ALTER TABLE proto_golf_requests ADD COLUMN element_selector text;
    END IF;

    -- Add element_text if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'proto_golf_requests' AND column_name = 'element_text') THEN
        ALTER TABLE proto_golf_requests ADD COLUMN element_text text;
    END IF;

    -- Add request_text if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'proto_golf_requests' AND column_name = 'request_text') THEN
        ALTER TABLE proto_golf_requests ADD COLUMN request_text text;
    END IF;

    -- Add input_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'proto_golf_requests' AND column_name = 'input_type') THEN
        ALTER TABLE proto_golf_requests ADD COLUMN input_type text DEFAULT 'text';
    END IF;

    -- Add status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'proto_golf_requests' AND column_name = 'status') THEN
        ALTER TABLE proto_golf_requests ADD COLUMN status text DEFAULT 'pending';
    END IF;

    -- Add page if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'proto_golf_requests' AND column_name = 'page') THEN
        ALTER TABLE proto_golf_requests ADD COLUMN page text;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE proto_golf_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read/write (admin dashboard uses anon key)
DROP POLICY IF EXISTS "Allow public read" ON proto_golf_requests;
CREATE POLICY "Allow public read" ON proto_golf_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON proto_golf_requests;
CREATE POLICY "Allow public insert" ON proto_golf_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON proto_golf_requests;
CREATE POLICY "Allow public update" ON proto_golf_requests FOR UPDATE USING (true);
