-- Migration: Fix reply count for unified replies
-- Replies are now public_reflections with parent_reflection_id
-- This trigger updates the parent's reply_count when replies are added/removed

-- Function to update reply count on parent reflection
CREATE OR REPLACE FUNCTION update_unified_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- New reply: increment parent's reply_count
        IF NEW.parent_reflection_id IS NOT NULL THEN
            UPDATE public_reflections 
            SET reply_count = COALESCE(reply_count, 0) + 1 
            WHERE id = NEW.parent_reflection_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Deleted reply: decrement parent's reply_count
        IF OLD.parent_reflection_id IS NOT NULL THEN
            UPDATE public_reflections 
            SET reply_count = GREATEST(COALESCE(reply_count, 0) - 1, 0) 
            WHERE id = OLD.parent_reflection_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for reply count updates
DROP TRIGGER IF EXISTS trigger_update_unified_reply_count ON public_reflections;
CREATE TRIGGER trigger_update_unified_reply_count
    AFTER INSERT OR DELETE ON public_reflections
    FOR EACH ROW EXECUTE FUNCTION update_unified_reply_count();

-- Fix existing reply counts (one-time update)
UPDATE public_reflections p
SET reply_count = (
    SELECT COUNT(*) 
    FROM public_reflections r 
    WHERE r.parent_reflection_id = p.id
)
WHERE EXISTS (
    SELECT 1 FROM public_reflections r WHERE r.parent_reflection_id = p.id
);
