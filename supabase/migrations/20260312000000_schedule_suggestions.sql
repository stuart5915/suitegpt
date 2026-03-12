-- Schedule content suggestions: community-sourced tweet ideas for @inclawbator slots
create table if not exists schedule_suggestions (
    id uuid primary key default gen_random_uuid(),
    slot_date date not null,           -- the calendar day of the slot
    slot_hour smallint not null,       -- UTC hour (1, 13, 16, 19, 22)
    wallet text not null,              -- submitter wallet address
    suggestion_text text not null,     -- the tweet idea (max ~280 chars)
    status text not null default 'pending',  -- pending | chosen | rejected
    reward_sent boolean default false, -- whether CLAWS reward was sent
    created_at timestamptz default now(),
    chosen_at timestamptz,
    chosen_by text                     -- wallet of the person who picked it
);

-- Index for fast lookup by slot
create index if not exists idx_suggestions_slot on schedule_suggestions (slot_date, slot_hour);
-- Index for lookup by wallet
create index if not exists idx_suggestions_wallet on schedule_suggestions (wallet);
