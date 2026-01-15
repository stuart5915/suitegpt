-- Create articles table
create table if not exists articles (
  id uuid default gen_random_uuid() primary key,
  project_id uuid, -- No FK constraint, projects table may not exist
  title text not null,
  slug text not null,
  content text,
  image_url text,
  image_prompt text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table articles enable row level security;

-- Policies for articles (Simplified for single-user dashboard context, otherwise needs auth.uid() check)
create policy "Enable all access for authenticated users" on articles
    for all using (auth.role() = 'authenticated');


-- Create storage bucket for article images
insert into storage.buckets (id, name, public) 
values ('article-images', 'article-images', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public Access" on storage.objects for select 
using ( bucket_id = 'article-images' );

create policy "Authenticated Upload" on storage.objects for insert 
with check ( bucket_id = 'article-images' and auth.role() = 'authenticated' );

create policy "Authenticated Update" on storage.objects for update
using ( bucket_id = 'article-images' and auth.role() = 'authenticated' );
