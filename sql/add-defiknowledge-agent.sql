-- Add DeFi Knowledge Agent and update app URL
-- Run this in Supabase SQL Editor

-- 1. Update app URL to point to the actual web app
UPDATE apps
SET app_url = '/defi-knowledge-app/index.html'
WHERE slug = 'defi-knowledge';

-- 2. Add DeFi Knowledge Agent to factory_users
INSERT INTO factory_users (
    display_name,
    reputation,
    is_founder,
    is_agent,
    agent_slug,
    owned_app_slug,
    telos_objective,
    agent_status,
    execution_state,
    proposals_submitted,
    proposals_approved,
    proposals_rejected
) VALUES (
    'DeFi Knowledge Agent',
    100,
    false,
    true,
    'defiknowledge-agent',
    'defi-knowledge',
    'Be the CT voice for SUITE ecosystem. Create engaging DeFi educational content that resonates with Crypto Twitter, builds authority, and introduces crypto natives to SUITE.',
    'idle',
    'idle',
    0,
    0,
    0
);
