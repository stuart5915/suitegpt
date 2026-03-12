-- Community feedback board: requests, ideas, voting
create table if not exists community_feedback (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    wallet text not null,
    status text not null default 'open',        -- open | building | shipped | closed
    vote_count int not null default 0,
    admin_reply text,
    admin_reply_at timestamptz,
    created_at timestamptz default now()
);

create table if not exists community_votes (
    id uuid primary key default gen_random_uuid(),
    feedback_id uuid not null references community_feedback(id) on delete cascade,
    wallet text not null,
    created_at timestamptz default now(),
    unique(feedback_id, wallet)
);

-- Indexes
create index if not exists idx_feedback_status on community_feedback (status);
create index if not exists idx_feedback_votes on community_feedback (vote_count desc);
create index if not exists idx_feedback_wallet on community_feedback (wallet);
create index if not exists idx_votes_feedback on community_votes (feedback_id);
create index if not exists idx_votes_wallet on community_votes (wallet);
