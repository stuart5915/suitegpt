-- API daily stats — lightweight request counter for Inclawbate
CREATE TABLE IF NOT EXISTS api_daily_stats (
    stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_requests INTEGER NOT NULL DEFAULT 0,
    agent_chat INTEGER NOT NULL DEFAULT 0,
    build_app INTEGER NOT NULL DEFAULT 0,
    token_launches INTEGER NOT NULL DEFAULT 0,
    staking_actions INTEGER NOT NULL DEFAULT 0,
    wallet_connects INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (stat_date)
);

-- Atomic increment function — upserts the row for today and bumps counters
CREATE OR REPLACE FUNCTION increment_api_stat(p_date DATE, p_category TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO api_daily_stats (stat_date, total_requests)
    VALUES (p_date, 1)
    ON CONFLICT (stat_date)
    DO UPDATE SET total_requests = api_daily_stats.total_requests + 1;

    IF p_category IS NOT NULL THEN
        EXECUTE format('UPDATE api_daily_stats SET %I = %I + 1 WHERE stat_date = $1', p_category, p_category) USING p_date;
    END IF;
END;
$$ LANGUAGE plpgsql;
