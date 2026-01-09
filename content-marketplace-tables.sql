-- Content Marketplace Tables
-- Run this in Supabase SQL Editor

-- Content bounties (requests for content)
CREATE TABLE content_bounties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_discord_id TEXT NOT NULL,
  requester_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT CHECK (content_type IN ('video', 'graphic', 'copy', 'other')) DEFAULT 'other',
  reward_amount INTEGER NOT NULL CHECK (reward_amount >= 10),
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'completed', 'forfeited')),
  winner_submission_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content submissions
CREATE TABLE content_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id UUID REFERENCES content_bounties(id) ON DELETE CASCADE,
  creator_discord_id TEXT NOT NULL,
  creator_name TEXT,
  content_url TEXT NOT NULL,
  description TEXT,
  is_winner BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for winner after submissions table exists
ALTER TABLE content_bounties 
ADD CONSTRAINT fk_winner_submission 
FOREIGN KEY (winner_submission_id) REFERENCES content_submissions(id);

-- Enable RLS
ALTER TABLE content_bounties ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_submissions ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow public read, authenticated write
CREATE POLICY "Public can read bounties" ON content_bounties FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert bounties" ON content_bounties FOR INSERT WITH CHECK (true);
CREATE POLICY "Requester can update own bounties" ON content_bounties FOR UPDATE USING (true);

CREATE POLICY "Public can read submissions" ON content_submissions FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert submissions" ON content_submissions FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_bounties_status ON content_bounties(status);
CREATE INDEX idx_bounties_deadline ON content_bounties(deadline);
CREATE INDEX idx_submissions_bounty ON content_submissions(bounty_id);
CREATE INDEX idx_submissions_creator ON content_submissions(creator_discord_id);
