-- OddsClaw atomic functions — prevent race conditions on balances and pools

-- ── Atomic wallet debit (with row lock) ──
CREATE OR REPLACE FUNCTION oddsclaw_debit_wallet(p_wallet TEXT, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT odds_balance INTO v_balance
    FROM oddsclaw_wallets
    WHERE wallet_address = p_wallet
    FOR UPDATE;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'Wallet not found';
    END IF;
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance: have %, need %', ROUND(v_balance, 2), ROUND(p_amount, 2);
    END IF;

    UPDATE oddsclaw_wallets
    SET odds_balance = odds_balance - p_amount
    WHERE wallet_address = p_wallet;

    RETURN v_balance - p_amount;
END;
$$ LANGUAGE plpgsql;

-- ── Atomic wallet credit (upsert) ──
CREATE OR REPLACE FUNCTION oddsclaw_credit_wallet(p_wallet TEXT, p_amount NUMERIC)
RETURNS NUMERIC AS $$
DECLARE
    v_balance NUMERIC;
BEGIN
    INSERT INTO oddsclaw_wallets (wallet_address, odds_balance)
    VALUES (p_wallet, p_amount)
    ON CONFLICT (wallet_address) DO UPDATE
    SET odds_balance = oddsclaw_wallets.odds_balance + EXCLUDED.odds_balance;

    SELECT odds_balance INTO v_balance
    FROM oddsclaw_wallets
    WHERE wallet_address = p_wallet;

    RETURN v_balance;
END;
$$ LANGUAGE plpgsql;

-- ── Atomic buy execution (locks market + wallet rows) ──
CREATE OR REPLACE FUNCTION oddsclaw_execute_buy(
    p_wallet TEXT,
    p_market_id UUID,
    p_side TEXT,
    p_amount NUMERIC,
    p_fee_rate NUMERIC,
    p_platform_wallet TEXT
) RETURNS JSONB AS $$
DECLARE
    v_market RECORD;
    v_balance NUMERIC;
    v_fee NUMERIC;
    v_net NUMERIC;
    v_shares NUMERIC;
    v_price NUMERIC;
    v_yes_pool NUMERIC;
    v_no_pool NUMERIC;
    v_existing RECORD;
    v_new_shares NUMERIC;
    v_new_cost NUMERIC;
BEGIN
    -- Lock and read market
    SELECT * INTO v_market FROM oddsclaw_markets WHERE id = p_market_id FOR UPDATE;
    IF v_market IS NULL THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market.status != 'active' THEN RAISE EXCEPTION 'Market is not active'; END IF;
    IF v_market.close_time <= NOW() THEN RAISE EXCEPTION 'Market is closed for trading'; END IF;

    -- Lock and read wallet
    SELECT odds_balance INTO v_balance FROM oddsclaw_wallets WHERE wallet_address = p_wallet FOR UPDATE;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance: have %, need %', ROUND(v_balance, 2), ROUND(p_amount, 2);
    END IF;

    -- Calculate trade
    v_fee := p_amount * p_fee_rate;
    v_net := p_amount - v_fee;
    v_yes_pool := v_market.yes_pool;
    v_no_pool := v_market.no_pool;

    IF p_side = 'yes' THEN
        v_shares := v_yes_pool - (v_yes_pool * v_no_pool) / (v_no_pool + v_net);
        IF v_shares >= v_yes_pool THEN v_shares := v_yes_pool * 0.99; END IF;
        v_yes_pool := v_yes_pool - v_shares;
        v_no_pool := v_no_pool + v_net;
    ELSE
        v_shares := v_no_pool - (v_yes_pool * v_no_pool) / (v_yes_pool + v_net);
        IF v_shares >= v_no_pool THEN v_shares := v_no_pool * 0.99; END IF;
        v_no_pool := v_no_pool - v_shares;
        v_yes_pool := v_yes_pool + v_net;
    END IF;

    IF v_shares <= 0 THEN RAISE EXCEPTION 'Trade too small'; END IF;

    v_price := v_net / v_shares;

    -- Debit buyer
    UPDATE oddsclaw_wallets SET odds_balance = odds_balance - p_amount WHERE wallet_address = p_wallet;

    -- Credit platform fee
    INSERT INTO oddsclaw_wallets (wallet_address, odds_balance)
    VALUES (p_platform_wallet, v_fee)
    ON CONFLICT (wallet_address) DO UPDATE
    SET odds_balance = oddsclaw_wallets.odds_balance + v_fee;

    -- Update market pools
    UPDATE oddsclaw_markets SET
        yes_pool = v_yes_pool,
        no_pool = v_no_pool,
        total_volume = total_volume + p_amount,
        trade_count = trade_count + 1
    WHERE id = p_market_id;

    -- Upsert position
    SELECT * INTO v_existing FROM oddsclaw_positions
    WHERE market_id = p_market_id AND wallet_address = p_wallet AND side = p_side;

    IF v_existing IS NOT NULL THEN
        v_new_shares := v_existing.shares + v_shares;
        v_new_cost := v_existing.total_cost + p_amount;
        UPDATE oddsclaw_positions SET
            shares = v_new_shares,
            total_cost = v_new_cost,
            avg_price = v_new_cost / v_new_shares
        WHERE id = v_existing.id;
    ELSE
        INSERT INTO oddsclaw_positions (market_id, wallet_address, side, shares, avg_price, total_cost)
        VALUES (p_market_id, p_wallet, p_side, v_shares, v_price, p_amount);
    END IF;

    -- Record trade
    INSERT INTO oddsclaw_trades (market_id, wallet_address, side, direction, shares, price, odds_amount, fee_odds, yes_pool_after, no_pool_after)
    VALUES (p_market_id, p_wallet, p_side, 'buy', v_shares, v_price, p_amount, v_fee, v_yes_pool, v_no_pool);

    RETURN jsonb_build_object(
        'shares', ROUND(v_shares, 6),
        'price', ROUND(v_price, 6),
        'fee', ROUND(v_fee, 6),
        'yes_pool', ROUND(v_yes_pool, 6),
        'no_pool', ROUND(v_no_pool, 6)
    );
END;
$$ LANGUAGE plpgsql;

-- ── Atomic sell execution (locks market + wallet + position rows) ──
CREATE OR REPLACE FUNCTION oddsclaw_execute_sell(
    p_wallet TEXT,
    p_market_id UUID,
    p_side TEXT,
    p_shares NUMERIC,
    p_fee_rate NUMERIC,
    p_platform_wallet TEXT
) RETURNS JSONB AS $$
DECLARE
    v_market RECORD;
    v_pos RECORD;
    v_odds_out NUMERIC;
    v_fee NUMERIC;
    v_payout NUMERIC;
    v_yes_pool NUMERIC;
    v_no_pool NUMERIC;
    v_new_shares NUMERIC;
    v_realized_pnl NUMERIC;
BEGIN
    -- Lock and read market
    SELECT * INTO v_market FROM oddsclaw_markets WHERE id = p_market_id FOR UPDATE;
    IF v_market IS NULL THEN RAISE EXCEPTION 'Market not found'; END IF;
    IF v_market.status != 'active' THEN RAISE EXCEPTION 'Market is not active'; END IF;
    IF v_market.close_time <= NOW() THEN RAISE EXCEPTION 'Market is closed for trading'; END IF;

    -- Lock and read position
    SELECT * INTO v_pos FROM oddsclaw_positions
    WHERE market_id = p_market_id AND wallet_address = p_wallet AND side = p_side
    FOR UPDATE;

    IF v_pos IS NULL OR v_pos.shares < p_shares THEN
        RAISE EXCEPTION 'Insufficient shares: have %, want to sell %',
            COALESCE(v_pos.shares, 0), p_shares;
    END IF;

    -- Calculate sell payout
    v_yes_pool := v_market.yes_pool;
    v_no_pool := v_market.no_pool;

    IF p_side = 'yes' THEN
        v_odds_out := v_no_pool - (v_yes_pool * v_no_pool) / (v_yes_pool + p_shares);
        IF v_odds_out >= v_no_pool THEN v_odds_out := v_no_pool * 0.99; END IF;
        v_yes_pool := v_yes_pool + p_shares;
        v_no_pool := v_no_pool - v_odds_out;
    ELSE
        v_odds_out := v_yes_pool - (v_yes_pool * v_no_pool) / (v_no_pool + p_shares);
        IF v_odds_out >= v_yes_pool THEN v_odds_out := v_yes_pool * 0.99; END IF;
        v_no_pool := v_no_pool + p_shares;
        v_yes_pool := v_yes_pool - v_odds_out;
    END IF;

    v_fee := v_odds_out * p_fee_rate;
    v_payout := v_odds_out - v_fee;

    IF v_payout <= 0 THEN RAISE EXCEPTION 'Trade too small'; END IF;

    -- Credit seller
    UPDATE oddsclaw_wallets SET odds_balance = odds_balance + v_payout WHERE wallet_address = p_wallet;

    -- Credit platform fee
    INSERT INTO oddsclaw_wallets (wallet_address, odds_balance)
    VALUES (p_platform_wallet, v_fee)
    ON CONFLICT (wallet_address) DO UPDATE
    SET odds_balance = oddsclaw_wallets.odds_balance + v_fee;

    -- Update market pools
    UPDATE oddsclaw_markets SET
        yes_pool = v_yes_pool,
        no_pool = v_no_pool,
        total_volume = total_volume + v_payout,
        trade_count = trade_count + 1
    WHERE id = p_market_id;

    -- Update position
    v_new_shares := v_pos.shares - p_shares;
    v_realized_pnl := v_payout - (v_pos.avg_price * p_shares);

    UPDATE oddsclaw_positions SET
        shares = v_new_shares,
        realized_pnl = realized_pnl + v_realized_pnl
    WHERE id = v_pos.id;

    -- Record trade
    INSERT INTO oddsclaw_trades (market_id, wallet_address, side, direction, shares, price, odds_amount, fee_odds, yes_pool_after, no_pool_after)
    VALUES (p_market_id, p_wallet, p_side, 'sell', p_shares, v_payout / p_shares, v_payout, v_fee, v_yes_pool, v_no_pool);

    RETURN jsonb_build_object(
        'payout', ROUND(v_payout, 6),
        'fee', ROUND(v_fee, 6),
        'yes_pool', ROUND(v_yes_pool, 6),
        'no_pool', ROUND(v_no_pool, 6)
    );
END;
$$ LANGUAGE plpgsql;

-- ── Leaderboard increment ──
CREATE OR REPLACE FUNCTION increment_oddsclaw_leaderboard(p_wallet TEXT, p_field TEXT, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
    INSERT INTO oddsclaw_leaderboard (wallet_address)
    VALUES (p_wallet)
    ON CONFLICT (wallet_address) DO NOTHING;

    CASE p_field
        WHEN 'markets_created' THEN
            UPDATE oddsclaw_leaderboard SET markets_created = markets_created + p_amount::INTEGER WHERE wallet_address = p_wallet;
        WHEN 'total_trades' THEN
            UPDATE oddsclaw_leaderboard SET total_trades = total_trades + p_amount::INTEGER WHERE wallet_address = p_wallet;
        WHEN 'total_volume' THEN
            UPDATE oddsclaw_leaderboard SET total_volume = total_volume + p_amount WHERE wallet_address = p_wallet;
        ELSE NULL;
    END CASE;
END;
$$ LANGUAGE plpgsql;
