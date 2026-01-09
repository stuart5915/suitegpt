-- =====================================================
-- SUITE Discuss Page - All Proposals
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, add snapshot_url column if it doesn't exist
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS snapshot_url TEXT;

-- =====================================================
-- SHIPPED PROPOSALS (Major Features Completed)
-- =====================================================

-- 1. LP Integration (Flagship shipped proposal - SNAPSHOT VERIFIED!)
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at, snapshot_url) VALUES (
    'SUITE/ETH Liquidity Pool on Aerodrome',
    E'Deploy SUITE/ETH liquidity pool on Aerodrome DEX (Base chain). Treasury seeds initial liquidity, 0.3% trading fees to LPs. Enables credit claims for reviewers.',
    'treasury', '0x0000000000000000000000000000000000000001', 'shipped', 150.0, 12.0, 28, NOW() - INTERVAL '7 days',
    'https://snapshot.org/#/suite.eth'
);

-- 2. Cadence AI Voice Integration
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Cadence AI: Text-to-Voice Feature',
    E'Integrate OpenAI real-time voice API into Cadence AI. Users can speak naturally and receive voice responses. Enables hands-free app development assistance.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 89.0, 3.0, 22, NOW() - INTERVAL '14 days'
);

-- 3. Video Content Automation
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Veo 2 Claymation Video Integration',
    E'Automated promo video generation using Veo 2 claymation style. Cadence AI can generate marketing videos for apps with coordinated timing and mascot animations.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 72.0, 8.0, 18, NOW() - INTERVAL '10 days'
);

-- 4. App Store & Supabase Connection
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Dynamic App Store with Supabase Backend',
    E'Connect app store to Supabase suite_apps table. Apps display dynamically with icons, descriptions, expo links, and status badges. Filter by category and status.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 95.0, 2.0, 24, NOW() - INTERVAL '21 days'
);

-- 5. Paid Reviews & Credits System
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Paid App Reviews with SUITE Credits',
    E'Developers fund review campaigns, users earn SUITE Credits for honest reviews. Credits claimable as real $SUITE. Includes "Pays to Review" filter on app store.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 110.0, 5.0, 32, NOW() - INTERVAL '2 days'
);

-- 6. Discord Bot & SUITE Hub
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'SUITE Hub Discord Integration',
    E'Discord bot for app creation requests, code change tracking, and community management. Auto-creates threads, handles reactions, and syncs with Cadence AI.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 88.0, 4.0, 20, NOW() - INTERVAL '18 days'
);

-- 7. Treasury Smart Contract
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'TreasuryV4: Multi-Token Deposits',
    E'Deploy Treasury contract accepting any ERC-20 token via 0x aggregator swap. Proportional share model ensures solvency. Returns ETH on SUITE withdrawal.',
    'treasury', '0x0000000000000000000000000000000000000001', 'shipped', 125.0, 15.0, 35, NOW() - INTERVAL '25 days'
);

-- 8. Developer Portal & Documentation
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Developer Portal with SDK & Quick Start',
    E'Complete developer documentation hub with quick start guides, SDK integration, commands reference, and step-by-step tutorials for building SUITE apps.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 67.0, 1.0, 16, NOW() - INTERVAL '30 days'
);

-- 9. Governance System
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Discuss Tab: Kanban Governance Board',
    E'Implement governance with Ideas → Voting → Approved → Shipped workflow. Wallet-signed votes, council badges, points system, and proposal creation.',
    'feature', '0x0000000000000000000000000000000000000001', 'shipped', 78.0, 6.0, 19, NOW() - INTERVAL '28 days'
);

-- 10. Giving/Charity Integration
INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Giving Page: Treasury-Funded Charity',
    E'Giving page displaying charity partners. 10% of Treasury yield allocated to monthly community-voted charities. Transparent donation tracking on-chain.',
    'charity', '0x0000000000000000000000000000000000000001', 'shipped', 145.0, 2.0, 42, NOW() - INTERVAL '20 days'
);

-- =====================================================
-- VOTING PROPOSALS (Active Discussion)
-- =====================================================

INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'App Revenue Sharing: 70/30 Developer Split',
    E'Standard revenue model: 70% Developer, 20% Treasury, 10% Charity. Creates sustainable incentives for builders.',
    'treasury', '0x0000000000000000000000000000000000000001', 'voting', 45.0, 8.0, 12, NOW() - INTERVAL '2 days'
);

INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Snapshot Integration for Major Votes',
    E'Use Snapshot for treasury decisions over 1000 SUITE. Adds legitimacy and gas-free voting for major proposals.',
    'feature', '0x0000000000000000000000000000000000000001', 'voting', 33.0, 12.0, 15, NOW() - INTERVAL '1 day'
);

-- =====================================================
-- IDEA PROPOSALS (New Suggestions)
-- =====================================================

INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Weekly SUITE Community Calls on Discord',
    E'Host 30-min community calls every Friday 7pm EST. Updates, app spotlights, Q&A with Stuart.',
    'feature', '0x0000000000000000000000000000000000000001', 'idea', 0, 0, 0, NOW()
);

INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'SUITE Mobile App (React Native)',
    E'Native mobile app for browsing SUITE apps, managing wallet, and earning on the go.',
    'feature', '0x0000000000000000000000000000000000000001', 'idea', 0, 0, 0, NOW() - INTERVAL '1 hour'
);

-- =====================================================
-- APPROVED (Ready for Implementation)
-- =====================================================

INSERT INTO proposals (title, description, category, author_wallet, status, yes_votes, no_votes, total_voters, created_at) VALUES (
    'Monthly Charity Spotlight & Donation',
    E'Community votes on charity each month. Winner receives 10% of Treasury yield and gets featured on Giving page.',
    'charity', '0x0000000000000000000000000000000000000001', 'approved', 89.0, 5.0, 22, NOW() - INTERVAL '5 days'
);
