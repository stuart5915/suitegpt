-- Agent Clients table for SUITE Business Agent portals
-- Each client (business) gets their own chat portal

CREATE TABLE IF NOT EXISTS agent_clients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    authorized_emails TEXT[] DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent requests/conversations
CREATE TABLE IF NOT EXISTS agent_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID REFERENCES agent_clients(id) ON DELETE CASCADE,
    title VARCHAR(500),
    conversation JSONB DEFAULT '[]',  -- Array of messages
    suggestions JSONB DEFAULT '[]',   -- AI-generated suggestions
    selected_options JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, in_progress, completed
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    submitted_by VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_clients_slug ON agent_clients(slug);
CREATE INDEX IF NOT EXISTS idx_agent_clients_created_by ON agent_clients(created_by);
CREATE INDEX IF NOT EXISTS idx_agent_requests_client_id ON agent_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_agent_requests_status ON agent_requests(status);

-- RLS Policies
ALTER TABLE agent_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can read clients (we check email in app logic)
CREATE POLICY "Anyone can read agent_clients" ON agent_clients
    FOR SELECT USING (true);

-- Only admins can insert/update clients (checked in app)
CREATE POLICY "Authenticated users can insert agent_clients" ON agent_clients
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update agent_clients" ON agent_clients
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Requests are readable by authenticated users (we filter by client in app)
CREATE POLICY "Authenticated can read agent_requests" ON agent_requests
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert agent_requests" ON agent_requests
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can update agent_requests" ON agent_requests
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Insert ProtoGolf as first client (example)
-- INSERT INTO agent_clients (slug, name, description, authorized_emails, created_by)
-- VALUES (
--     'protogolf',
--     'ProtoGolf',
--     'AI-powered golf training platform',
--     ARRAY['owner@protogolf.com'],
--     'stuart5915@gmail.com'
-- );
