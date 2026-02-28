-- Rename inclawnch_amount → claws_amount in agent deposits (no data exists yet)
ALTER TABLE inclawbator_agent_deposits
    RENAME COLUMN inclawnch_amount TO claws_amount;

-- Also expand tier constraint to include ecosystem + partner
ALTER TABLE inclawbator_projects
    DROP CONSTRAINT IF EXISTS inclawbator_projects_tier_check;
ALTER TABLE inclawbator_projects
    ADD CONSTRAINT inclawbator_projects_tier_check
    CHECK (tier IN ('incubated', 'permissionless', 'ecosystem', 'partner', 'byt'));
