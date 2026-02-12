-- Add file attachment support to messages
ALTER TABLE inclawbate_messages
    ADD COLUMN IF NOT EXISTS file_url text,
    ADD COLUMN IF NOT EXISTS file_name text,
    ADD COLUMN IF NOT EXISTS file_type text;
