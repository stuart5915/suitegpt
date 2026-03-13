-- Rich personality fields for AI agents
-- Replaces basic tone/catchphrase with deep character customization

-- Backstory / identity
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_backstory text;

-- Writing style examples (array of example tweets to learn from)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_examples jsonb DEFAULT '[]';

-- Opinions and knowledge areas
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_opinions text;

-- Custom vocabulary (words they use, words they avoid)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_vocabulary jsonb DEFAULT '{}';

-- Explicit do's and don'ts
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_rules jsonb DEFAULT '{}';

-- Knowledge base / reference material
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_knowledge text;
