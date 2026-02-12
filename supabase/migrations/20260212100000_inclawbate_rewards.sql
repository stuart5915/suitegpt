-- Weekly rewards config (singleton row)
CREATE TABLE inclawbate_rewards (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_pool numeric NOT NULL DEFAULT 1000000,
    next_pool numeric NOT NULL DEFAULT 1000000,
    last_distributed numeric NOT NULL DEFAULT 0,
    total_distributed numeric NOT NULL DEFAULT 0,
    week_ends_at timestamptz NOT NULL DEFAULT (date_trunc('week', now() + interval '1 week')),
    top_n integer NOT NULL DEFAULT 10,
    updated_at timestamptz DEFAULT now()
);

-- Seed the initial row
INSERT INTO inclawbate_rewards (id) VALUES (1);
