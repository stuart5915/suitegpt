-- Create a table for public profiles
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  bio text,
  location text,
  website text,
  avatar_url text,
  banner_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.profiles enable row level security;

-- Allow public read access
create policy "Public profiles are viewable by everyone."
  on public.profiles for select
  using ( true );

-- Allow users to insert their own profile
create policy "Users can insert their own profile."
  on public.profiles for insert
  with check ( auth.uid() = id );

-- Allow users to update their own profile
create policy "Users can update own profile."
  on public.profiles for update
  using ( auth.uid() = id );
