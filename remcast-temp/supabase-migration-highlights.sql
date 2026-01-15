-- Run this ONLY to add the new highlighting features
-- (If you have already run the previous schema, you only need this part)

-- Verse Highlights table
create table if not exists verse_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  book text not null,
  chapter integer not null,
  verse integer not null,
  color text not null, -- Stores hex code or preset name (e.g., '#FFD700' or 'yellow')
  created_at timestamp with time zone default now(),
  unique(user_id, book, chapter, verse)
);

-- Enable RLS for verse_highlights
alter table verse_highlights enable row level security;

-- RLS Policies for verse_highlights
-- Drop existing policies if they exist to prevent errors on re-run
drop policy if exists "Users can view own highlights" on verse_highlights;
drop policy if exists "Users can insert own highlights" on verse_highlights;
drop policy if exists "Users can update own highlights" on verse_highlights;
drop policy if exists "Users can delete own highlights" on verse_highlights;

create policy "Users can view own highlights"
  on verse_highlights for select
  using (auth.uid() = user_id);

create policy "Users can insert own highlights"
  on verse_highlights for insert
  with check (auth.uid() = user_id);

create policy "Users can update own highlights"
  on verse_highlights for update
  using (auth.uid() = user_id);

create policy "Users can delete own highlights"
  on verse_highlights for delete
  using (auth.uid() = user_id);

-- Index for verse_highlights
create index if not exists verse_highlights_user_id_idx on verse_highlights(user_id);
create index if not exists verse_highlights_location_idx on verse_highlights(book, chapter);
