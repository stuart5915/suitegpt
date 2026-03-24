-- Council request chat system
-- Users submit requests via Inclawbator → TG council group → council replies route back

create table if not exists council_requests (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  contact text not null, -- @handle, telegram, email
  description text not null,
  status text not null default 'open', -- open, in_progress, resolved, closed
  tg_message_id text, -- telegram message ID for thread replies
  messages jsonb not null default '[]'::jsonb, -- [{role: 'user'|'council', name, text, at}]
  wallet text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_council_requests_session on council_requests(session_id);
create index if not exists idx_council_requests_status on council_requests(status);
