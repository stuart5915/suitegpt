CREATE TABLE IF NOT EXISTS pitches (
    id bigint generated always as identity primary key,
    message text not null,
    contact text,
    ip text,
    created_at timestamptz default now()
);
