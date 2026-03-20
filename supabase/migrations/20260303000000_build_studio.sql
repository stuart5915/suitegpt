-- Build Studio tables for inclawbate.app/build
-- Chat-based AI builder: users describe what they want, Claude generates HTML, live preview

-- ── Sessions ──
CREATE TABLE build_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES human_profiles(id) NOT NULL,
    title text NOT NULL DEFAULT 'Untitled Project',
    current_code text,
    slug text UNIQUE,
    published_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_build_sessions_profile ON build_sessions(profile_id);
CREATE INDEX idx_build_sessions_slug ON build_sessions(slug) WHERE slug IS NOT NULL;

-- ── Messages ──
CREATE TABLE build_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid REFERENCES build_sessions(id) ON DELETE CASCADE NOT NULL,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    content text NOT NULL,
    code text,
    tokens_used integer DEFAULT 0,
    credits_charged integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_build_messages_session ON build_messages(session_id, created_at);

-- ── RLS ──
ALTER TABLE build_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_messages ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS; these policies are for client-side access if needed
CREATE POLICY "Users can view own sessions"
    ON build_sessions FOR SELECT
    USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
    ON build_sessions FOR INSERT
    WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own sessions"
    ON build_sessions FOR UPDATE
    USING (profile_id = auth.uid());

CREATE POLICY "Users can view own messages"
    ON build_messages FOR SELECT
    USING (session_id IN (SELECT id FROM build_sessions WHERE profile_id = auth.uid()));
