-- Fix OddsClaw RLS policies — restrict to service_role only
-- The original policies used USING (true) which grants access to anon/authenticated roles too

-- Drop old wide-open policies
DROP POLICY IF EXISTS "Service role full access" ON oddsclaw_markets;
DROP POLICY IF EXISTS "Service role full access" ON oddsclaw_positions;
DROP POLICY IF EXISTS "Service role full access" ON oddsclaw_trades;
DROP POLICY IF EXISTS "Service role full access" ON oddsclaw_disputes;
DROP POLICY IF EXISTS "Service role full access" ON oddsclaw_wallets;
DROP POLICY IF EXISTS "Service role full access" ON oddsclaw_leaderboard;

-- Recreate with TO service_role restriction
CREATE POLICY "Service role full access" ON oddsclaw_markets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_positions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_trades FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_disputes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_wallets FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON oddsclaw_leaderboard FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add read-only access for anon (so the frontend can fetch markets/leaderboard directly if needed)
CREATE POLICY "Anon read markets" ON oddsclaw_markets FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read trades" ON oddsclaw_trades FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read leaderboard" ON oddsclaw_leaderboard FOR SELECT TO anon USING (true);
