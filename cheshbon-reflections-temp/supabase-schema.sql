-- Cheshbon Reflections Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Create reading_plans table
create table reading_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('canonical', 'chronological', 'nt90', 'custom')),
  duration integer not null,
  start_date date not null,
  current_day integer not null default 1,
  is_active boolean not null default true,
  completed boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create journal_entries table
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references reading_plans(id) on delete cascade,
  day_number integer,
  date date not null,
  book text not null,
  chapter integer not null,
  reflection text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create daily_progress table
create table daily_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references reading_plans(id) on delete cascade not null,
  date date not null,
  completed boolean not null default false,
  created_at timestamp with time zone default now(),
  unique(plan_id, date)
);

-- Enable Row Level Security
alter table reading_plans enable row level security;
alter table journal_entries enable row level security;
alter table daily_progress enable row level security;

-- RLS Policies for reading_plans
create policy "Users can view own plans"
  on reading_plans for select
  using (auth.uid() = user_id);

create policy "Users can insert own plans"
  on reading_plans for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plans"
  on reading_plans for update
  using (auth.uid() = user_id);

create policy "Users can delete own plans"
  on reading_plans for delete
  using (auth.uid() = user_id);

-- RLS Policies for journal_entries
create policy "Users can view own entries"
  on journal_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert own entries"
  on journal_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update own entries"
  on journal_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete own entries"
  on journal_entries for delete
  using (auth.uid() = user_id);

-- RLS Policies for daily_progress
create policy "Users can view own progress"
  on daily_progress for select
  using (auth.uid() = user_id);

create policy "Users can insert own progress"
  on daily_progress for insert
  with check (auth.uid() = user_id);

create policy "Users can update own progress"
  on daily_progress for update
  using (auth.uid() = user_id);

create policy "Users can delete own progress"
  on daily_progress for delete
  using (auth.uid() = user_id);

-- Create indexes for better query performance
create index reading_plans_user_id_idx on reading_plans(user_id);
create index reading_plans_is_active_idx on reading_plans(is_active);
create index journal_entries_user_id_idx on journal_entries(user_id);
create index journal_entries_plan_id_idx on journal_entries(plan_id);
create index daily_progress_user_id_idx on daily_progress(user_id);
create index daily_progress_plan_id_idx on daily_progress(plan_id);

-- Verse Reflections table
create table verse_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  verse_reference text not null,
  verse_text text not null,
  reflection text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, date)
);

-- Enable RLS for verse_reflections
alter table verse_reflections enable row level security;

-- RLS Policies for verse_reflections
create policy "Users can view own verse reflections"
  on verse_reflections for select
  using (auth.uid() = user_id);

create policy "Users can insert own verse reflections"
  on verse_reflections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own verse reflections"
  on verse_reflections for update
  using (auth.uid() = user_id);

create policy "Users can delete own verse reflections"
  on verse_reflections for delete
  using (auth.uid() = user_id);

-- Index for verse_reflections
create index verse_reflections_user_id_idx on verse_reflections(user_id);
create index verse_reflections_date_idx on verse_reflections(date);

-- Plan Reflections table (for completed plan summaries)
create table plan_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_id uuid references reading_plans(id) on delete cascade not null,
  reflection text not null,
  completed_date date not null,
  created_at timestamp with time zone default now(),
  unique(user_id, plan_id)
);

-- Enable RLS for plan_reflections
alter table plan_reflections enable row level security;

-- RLS Policies for plan_reflections
create policy "Users can view own plan reflections"
  on plan_reflections for select
  using (auth.uid() = user_id);

create policy "Users can insert own plan reflections"
  on plan_reflections for insert
  with check (auth.uid() = user_id);

create policy "Users can update own plan reflections"
  on plan_reflections for update
  using (auth.uid() = user_id);

create policy "Users can delete own plan reflections"
  on plan_reflections for delete
  using (auth.uid() = user_id);

-- Indexes for plan_reflections
create index plan_reflections_user_id_idx on plan_reflections(user_id);
create index plan_reflections_plan_id_idx on plan_reflections(plan_id);

-- User Profiles table (for streak tracking)
create table user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  current_streak integer not null default 0,
  last_reflection_date date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS for user_profiles
alter table user_profiles enable row level security;

-- RLS Policies for user_profiles
create policy "Users can view own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = user_id);

-- Index for user_profiles
create index user_profiles_user_id_idx on user_profiles(user_id);

-- Daily Verses table (global cache for verse of the day)
create table daily_verses (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  verse_reference text not null,
  verse_text text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS for daily_verses
alter table daily_verses enable row level security;

-- RLS Policies for daily_verses (anyone can read, only authenticated users can insert)
create policy "Anyone can read daily verses"
  on daily_verses for select
  using (true);

create policy "Authenticated users can insert daily verses"
  on daily_verses for insert
  with check (auth.uid() is not null);

-- Index for daily_verses

-- User Bible Versions table
create table user_bible_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  version_id text not null, -- API.Bible version ID
  abbreviation text,
  name text,
  language text,
  is_downloaded boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, version_id)
);

-- Enable RLS for user_bible_versions
alter table user_bible_versions enable row level security;

-- RLS Policies for user_bible_versions
create policy "Users can view own bible versions"
  on user_bible_versions for select
  using (auth.uid() = user_id);

create policy "Users can insert own bible versions"
  on user_bible_versions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bible versions"
  on user_bible_versions for update
  using (auth.uid() = user_id);

create policy "Users can delete own bible versions"
  on user_bible_versions for delete
  using (auth.uid() = user_id);

-- Index for user_bible_versions
create index user_bible_versions_user_id_idx on user_bible_versions(user_id);

-- Verse Highlights table
create table verse_highlights (
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
create index verse_highlights_user_id_idx on verse_highlights(user_id);
create index verse_highlights_location_idx on verse_highlights(book, chapter);
