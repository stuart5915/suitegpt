-- ═══════════════════════════════════════════════════════════════
-- StuartFactoryBot Schema
-- Dynamic destinations linked to NoteBox + conversation state
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- Intake Destinations (synced with NoteBox bins + external targets)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_destinations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Display info
    name TEXT NOT NULL,                    -- "SUITE Factory", "ArtStu", "TrueForm"
    slug TEXT UNIQUE NOT NULL,             -- "suite", "artstu", "trueform"
    description TEXT,                      -- Shown to help AI classify
    icon TEXT DEFAULT '📝',                -- Emoji for Telegram display

    -- Where does content go?
    target_type TEXT NOT NULL DEFAULT 'notebox',  -- 'notebox', 'article', 'github', 'custom'
    notebox_status TEXT,                   -- Maps to personal_ideas.status (inbox, pushed, artstu)
    external_url TEXT,                     -- For articles: getsuite.app/learn, artstu.ca/blog, etc.
    github_repo TEXT,                      -- For feature requests: owner/repo

    -- AI Classification hints
    keywords TEXT[],                       -- Words that suggest this destination
    example_messages TEXT[],               -- Example inputs for this destination

    -- Template questions (asked after classification)
    template_questions JSONB DEFAULT '[]', -- [{question: "...", required: true}]

    -- Prompt template for Claude CLI
    prompt_template TEXT,                  -- Template with {title}, {content}, {answers} placeholders

    -- Active/ordering
    active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_intake_destinations_slug ON intake_destinations(slug);
CREATE INDEX IF NOT EXISTS idx_intake_destinations_active ON intake_destinations(active);

-- ─────────────────────────────────────────────────────────────────
-- Intake Conversations (tracks bot conversation state)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS intake_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Telegram info
    telegram_user_id TEXT NOT NULL,
    telegram_chat_id TEXT NOT NULL,
    telegram_username TEXT,

    -- Raw input
    raw_message TEXT NOT NULL,

    -- AI Classification result
    detected_destination_id UUID REFERENCES intake_destinations(id),
    confidence DECIMAL(3,2),              -- 0.00 to 1.00
    extracted_title TEXT,
    extracted_content TEXT,

    -- Question/Answer flow
    current_question_index INT DEFAULT 0,
    answers JSONB DEFAULT '{}',           -- {question_key: answer}

    -- Generated prompt (for review)
    generated_prompt TEXT,

    -- State machine
    status TEXT DEFAULT 'classifying',    -- 'classifying', 'confirming_destination', 'asking_questions', 'reviewing_prompt', 'approved', 'executing', 'done', 'cancelled'

    -- Result
    result_url TEXT,                      -- URL of published content
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intake_conversations_telegram ON intake_conversations(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_intake_conversations_status ON intake_conversations(status);

-- ─────────────────────────────────────────────────────────────────
-- Seed default destinations (synced with NoteBox)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO intake_destinations (name, slug, description, icon, target_type, notebox_status, keywords, example_messages, template_questions, prompt_template, sort_order)
VALUES
(
    'Stuart Factory',
    'stuart',
    'Personal ideas, tasks, and notes for Stuart',
    '🏭',
    'notebox',
    'inbox',
    ARRAY['personal', 'reminder', 'todo', 'task', 'note', 'idea'],
    ARRAY['remind me to...', 'note to self:', 'I should...', 'idea:'],
    '[{"key": "priority", "question": "How urgent is this?", "options": ["Now", "Soon", "Someday"], "required": false}]',
    'New personal note/idea:\n\nTitle: {title}\nContent: {content}\nPriority: {priority}\n\nAdd to my Stuart Factory inbox.',
    1
),
(
    'SUITE Factory',
    'suite',
    'Features, improvements, and ideas for the SUITE ecosystem (getsuite.app)',
    '🚀',
    'notebox',
    'pushed',
    ARRAY['suite', 'getsuite', 'app', 'feature', 'defi', 'yield', 'token', 'ecosystem'],
    ARRAY['new feature for suite:', 'suite should...', 'add to getsuite:', 'suite idea:'],
    '[{"key": "app", "question": "Which SUITE app does this relate to?", "options": ["FoodVitals", "Cheshbon", "OpticRep", "TrueForm", "REMcast", "New App", "Ecosystem/General"], "required": true}, {"key": "type", "question": "What type of item is this?", "options": ["Feature Request", "Bug Fix", "Improvement", "New App Idea"], "required": true}]',
    'SUITE Feature Request:\n\nApp: {app}\nType: {type}\nTitle: {title}\nDetails: {content}\n\nPlease analyze and implement this in the SUITE ecosystem.',
    2
),
(
    'ArtStu',
    'artstu',
    'Articles and content for artstu.ca - philosophy, faith, technology',
    '✍️',
    'notebox',
    'artstu',
    ARRAY['article', 'blog', 'write', 'artstu', 'philosophy', 'faith', 'essay', 'thought'],
    ARRAY['new article:', 'write about:', 'blog post idea:', 'artstu article:'],
    '[{"key": "theme", "question": "What''s the main theme?", "options": ["Philosophy", "Faith", "Technology", "Personal Growth", "Other"], "required": true}, {"key": "audience", "question": "Who is this for?", "options": ["General audience", "Christians", "Tech people", "Personal reflection"], "required": false}, {"key": "tone", "question": "What tone should it have?", "options": ["Thoughtful/contemplative", "Practical/actionable", "Storytelling", "Academic"], "required": false}]',
    'Write an article for artstu.ca:\n\nTopic: {title}\nTheme: {theme}\nAudience: {audience}\nTone: {tone}\n\nNotes/outline: {content}\n\nPlease write a thoughtful article exploring this topic.',
    3
),
(
    'SUITE Learn',
    'suite-learn',
    'Educational articles for getsuite.app/learn - explaining SUITE concepts',
    '📚',
    'article',
    NULL,
    ARRAY['explain', 'tutorial', 'guide', 'learn', 'documentation', 'how to'],
    ARRAY['explain how:', 'write a guide for:', 'tutorial:', 'document:'],
    '[{"key": "level", "question": "What level is this for?", "options": ["Beginner", "Intermediate", "Advanced"], "required": true}, {"key": "tags", "question": "What tags apply?", "options": ["AI", "DeFi", "Tokenomics", "Philosophy", "Apps"], "multiple": true, "required": true}]',
    '/publish-article\n\nTitle: {title}\nTags: {tags}\nDestination: learn\n\n---\n\n{content}\n\n---\n\nLevel: {level}\nPlease format as an educational article for SUITE Learn.',
    4
),
(
    'TrueForm',
    'trueform',
    'Feature requests and ideas for TrueForm AI Physiotherapist app',
    '🏋️',
    'notebox',
    'pushed',
    ARRAY['trueform', 'physio', 'exercise', 'workout', 'form', 'posture', 'injury'],
    ARRAY['trueform feature:', 'trueform should:', 'add to trueform:'],
    '[{"key": "area", "question": "What area of the app?", "options": ["Exercise tracking", "Form analysis", "Injury prevention", "UI/UX", "Other"], "required": true}]',
    'TrueForm Feature Request:\n\nArea: {area}\nTitle: {title}\nDetails: {content}\n\nPlease implement in the TrueForm app.',
    5
),
(
    'FoodVitals',
    'foodvitals',
    'Feature requests and ideas for FoodVitals nutrition tracking app',
    '🍎',
    'notebox',
    'pushed',
    ARRAY['foodvitals', 'food', 'nutrition', 'scan', 'barcode', 'calories', 'diet'],
    ARRAY['foodvitals feature:', 'foodvitals should:', 'add to foodvitals:'],
    '[{"key": "area", "question": "What area of the app?", "options": ["Barcode scanning", "Nutrition analysis", "Meal tracking", "UI/UX", "Other"], "required": true}]',
    'FoodVitals Feature Request:\n\nArea: {area}\nTitle: {title}\nDetails: {content}\n\nPlease implement in the FoodVitals app.',
    6
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    keywords = EXCLUDED.keywords,
    template_questions = EXCLUDED.template_questions,
    prompt_template = EXCLUDED.prompt_template,
    updated_at = NOW();

-- ─────────────────────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE intake_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_conversations ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service full access intake_destinations" ON intake_destinations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service full access intake_conversations" ON intake_conversations FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────
-- Auto-update timestamps
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_intake_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_intake_destinations_updated ON intake_destinations;
CREATE TRIGGER trigger_intake_destinations_updated
    BEFORE UPDATE ON intake_destinations
    FOR EACH ROW EXECUTE FUNCTION update_intake_updated_at();

DROP TRIGGER IF EXISTS trigger_intake_conversations_updated ON intake_conversations;
CREATE TRIGGER trigger_intake_conversations_updated
    BEFORE UPDATE ON intake_conversations
    FOR EACH ROW EXECUTE FUNCTION update_intake_updated_at();
