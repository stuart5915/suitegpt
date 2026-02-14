CREATE TABLE IF NOT EXISTS inclawbate_ubi_requests (
    id serial PRIMARY KEY,
    wallet_address text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    amount_requested numeric NOT NULL CHECK (amount_requested > 0),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'funded', 'closed')),
    total_funded numeric DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ubi_requests_status ON inclawbate_ubi_requests(status);

CREATE TABLE IF NOT EXISTS inclawbate_ubi_request_comments (
    id serial PRIMARY KEY,
    request_id integer NOT NULL REFERENCES inclawbate_ubi_requests(id) ON DELETE CASCADE,
    wallet_address text NOT NULL,
    comment text NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ubi_request_comments_request ON inclawbate_ubi_request_comments(request_id);
