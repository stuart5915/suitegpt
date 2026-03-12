-- AgentScape daily evolution system
CREATE TABLE IF NOT EXISTS agentscape_evolutions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    day_number integer NOT NULL,
    created_at timestamptz DEFAULT now(),
    type text NOT NULL CHECK (type IN ('new_monster', 'balance_tweak', 'world_event')),
    title text NOT NULL,
    description text NOT NULL,
    data jsonb NOT NULL,
    active boolean DEFAULT true
);

CREATE INDEX idx_evolutions_day ON agentscape_evolutions(day_number DESC);
CREATE INDEX idx_evolutions_active ON agentscape_evolutions(active) WHERE active = true;
