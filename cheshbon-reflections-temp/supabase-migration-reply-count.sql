-- Add reply_count column to public_reflections
-- Run this in Supabase SQL Editor

-- 1. Add the reply_count column
ALTER TABLE public_reflections ADD COLUMN IF NOT EXISTS reply_count INT DEFAULT 0;

-- 2. Update existing reply counts from current data
UPDATE public_reflections pr
SET reply_count = (
    SELECT COUNT(*) FROM reflection_replies rr WHERE rr.reflection_id = pr.id
);

-- 3. Create function to update reply_count when replies change
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public_reflections 
        SET reply_count = reply_count + 1 
        WHERE id = NEW.reflection_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public_reflections 
        SET reply_count = reply_count - 1 
        WHERE id = OLD.reflection_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create triggers
DROP TRIGGER IF EXISTS on_reply_insert ON reflection_replies;
CREATE TRIGGER on_reply_insert
    AFTER INSERT ON reflection_replies
    FOR EACH ROW EXECUTE FUNCTION update_reply_count();

DROP TRIGGER IF EXISTS on_reply_delete ON reflection_replies;
CREATE TRIGGER on_reply_delete
    AFTER DELETE ON reflection_replies
    FOR EACH ROW EXECUTE FUNCTION update_reply_count();
