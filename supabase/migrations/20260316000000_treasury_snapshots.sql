-- Treasury snapshots — one row per day, stored by council-daily cron
create table treasury_snapshots (
  id bigint generated always as identity primary key,
  snapshot_date date not null unique,
  claws_price numeric,
  change_24h numeric,
  volume_24h numeric,
  liquidity numeric,
  mcap numeric,
  staked_amount numeric,
  staked_pct numeric,
  lp_amount numeric,
  lp_pct numeric,
  total_locked_pct numeric,
  treasury_total numeric,
  lp_value numeric,
  staked_value numeric,
  earned_value numeric,
  voter_count integer,
  created_at timestamptz default now()
);

create index idx_treasury_snapshots_date on treasury_snapshots (snapshot_date desc);
