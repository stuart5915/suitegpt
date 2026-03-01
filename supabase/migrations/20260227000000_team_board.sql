-- Team Board — wallet-gated Kanban for Inclawbate team
-- Tables: team_members, team_columns, team_cards

-- Team members (wallet-gated access)
create table team_members (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null unique,
  display_name text,
  role text not null default 'member',  -- 'admin' or 'member'
  created_at timestamptz default now()
);

-- Seed Stuart as admin
insert into team_members (wallet_address, display_name, role)
values ('0x91b5c0d07859cfeafeb67d9694121cd741f049bd', 'Stuart', 'admin');

-- Kanban columns
create table team_columns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position int not null default 0,
  created_at timestamptz default now()
);

-- Seed default columns
insert into team_columns (title, position) values
  ('Backlog', 0),
  ('In Progress', 1),
  ('Review', 2),
  ('Done', 3);

-- Kanban cards (tasks)
create table team_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references team_columns(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references team_members(id),
  priority text default 'normal',  -- 'low', 'normal', 'high', 'urgent'
  position int not null default 0,
  created_by uuid references team_members(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
