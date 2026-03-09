-- Team State table for Inclawbate CEO Bot
-- Stores updates, priorities, tasks, notes, blockers, ships, vision

create table if not exists team_state (
    id uuid primary key default gen_random_uuid(),
    category text not null default 'note',  -- state, priority, task, note, ship, blocker, vision
    content text not null,
    author text,  -- telegram username
    created_at timestamptz not null default now()
);

-- Index for quick lookups
create index if not exists idx_team_state_category on team_state(category);
create index if not exists idx_team_state_created on team_state(created_at desc);

-- RLS: allow service role full access (bot uses service role key)
alter table team_state enable row level security;

create policy "Service role full access" on team_state
    for all using (true) with check (true);
