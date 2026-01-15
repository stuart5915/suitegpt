-- Add counts to public_reflections
ALTER TABLE public_reflections ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;
ALTER TABLE public_reflections ADD COLUMN IF NOT EXISTS repost_count INT DEFAULT 0;

-- Reflection Reposts Table
CREATE TABLE IF NOT EXISTS reflection_reposts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reflection_id UUID NOT NULL REFERENCES public_reflections(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, reflection_id)
);

-- RLS for Reposts
ALTER TABLE reflection_reposts ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read reposts') THEN
        CREATE POLICY "Anyone can read reposts" ON reflection_reposts FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can repost') THEN
        CREATE POLICY "Users can repost" ON reflection_reposts FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can undo repost') THEN
        CREATE POLICY "Users can undo repost" ON reflection_reposts FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- RPC Functions for Atomic Counters
create or replace function increment_repost_count(row_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public_reflections
  set repost_count = repost_count + 1
  where id = row_id;
end;
$$;

create or replace function decrement_repost_count(row_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public_reflections
  set repost_count = repost_count - 1
  where id = row_id;
end;
$$;

create or replace function increment_view_count(row_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public_reflections
  set views_count = views_count + 1
  where id = row_id;
end;
$$;
