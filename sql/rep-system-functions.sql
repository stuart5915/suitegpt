-- =====================================================
-- REP SYSTEM FUNCTIONS
-- Connects Factory REP to treasury yield and proposal outcomes
-- =====================================================

-- =====================================================
-- 1. DISTRIBUTE REP FROM TREASURY YIELD
-- Called after vault value report shows positive yield
-- Awards 1 REP per $1 of yield earned, proportional to LP share
-- =====================================================

CREATE OR REPLACE FUNCTION distribute_rep_from_yield()
RETURNS TABLE (
    users_processed INTEGER,
    total_yield_usd DECIMAL,
    total_rep_awarded INTEGER
) AS $$
DECLARE
    v_previous_value DECIMAL;
    v_current_value DECIMAL;
    v_total_yield DECIMAL;
    v_total_lp DECIMAL;
    v_user RECORD;
    v_user_yield DECIMAL;
    v_user_rep INTEGER;
    v_users_count INTEGER := 0;
    v_total_rep INTEGER := 0;
    v_factory_user_id UUID;
BEGIN
    -- Get current and previous vault values
    SELECT reported_value_usd INTO v_current_value
    FROM vault_value_reports
    ORDER BY reported_at DESC
    LIMIT 1;

    SELECT reported_value_usd INTO v_previous_value
    FROM vault_value_reports
    ORDER BY reported_at DESC
    OFFSET 1
    LIMIT 1;

    -- If no previous value or no growth, nothing to distribute
    IF v_previous_value IS NULL OR v_current_value <= v_previous_value THEN
        RETURN QUERY SELECT 0, 0::DECIMAL, 0;
        RETURN;
    END IF;

    -- Calculate total yield
    v_total_yield := v_current_value - v_previous_value;

    -- Get total LP supply
    SELECT COALESCE(SUM(lp_tokens_issued), 0) INTO v_total_lp
    FROM treasury_deposits
    WHERE withdrawn = FALSE;

    IF v_total_lp = 0 THEN
        RETURN QUERY SELECT 0, v_total_yield, 0;
        RETURN;
    END IF;

    -- Process each depositor
    FOR v_user IN
        SELECT
            td.wallet_address,
            SUM(td.lp_tokens_issued) AS lp_tokens
        FROM treasury_deposits td
        WHERE td.withdrawn = FALSE
        GROUP BY td.wallet_address
    LOOP
        -- Calculate user's share of yield
        v_user_yield := (v_user.lp_tokens / v_total_lp) * v_total_yield;

        -- 1 REP per $1 yield
        v_user_rep := FLOOR(v_user_yield);

        IF v_user_rep > 0 THEN
            -- Find factory user by wallet
            SELECT id INTO v_factory_user_id
            FROM factory_users
            WHERE LOWER(wallet_address) = LOWER(v_user.wallet_address);

            IF v_factory_user_id IS NOT NULL THEN
                -- Award REP
                UPDATE factory_users
                SET reputation = reputation + v_user_rep
                WHERE id = v_factory_user_id;

                -- Log to history
                INSERT INTO factory_rep_history (user_id, amount, reason)
                VALUES (v_factory_user_id, v_user_rep, 'treasury_yield');

                v_users_count := v_users_count + 1;
                v_total_rep := v_total_rep + v_user_rep;
            END IF;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_users_count, v_total_yield, v_total_rep;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 2. AWARD REP ON TREASURY DEPOSIT
-- Awards 1 REP per $1 deposited (one-time)
-- =====================================================

CREATE OR REPLACE FUNCTION award_rep_on_deposit()
RETURNS TRIGGER AS $$
DECLARE
    v_factory_user_id UUID;
    v_rep_amount INTEGER;
BEGIN
    -- Calculate REP: 1 per $1 deposited
    v_rep_amount := FLOOR(NEW.usd_value_at_deposit);

    IF v_rep_amount > 0 THEN
        -- Find factory user by wallet
        SELECT id INTO v_factory_user_id
        FROM factory_users
        WHERE LOWER(wallet_address) = LOWER(NEW.wallet_address);

        IF v_factory_user_id IS NOT NULL THEN
            -- Award REP
            UPDATE factory_users
            SET reputation = reputation + v_rep_amount
            WHERE id = v_factory_user_id;

            -- Log to history
            INSERT INTO factory_rep_history (user_id, amount, reason)
            VALUES (v_factory_user_id, v_rep_amount, 'treasury_deposit');
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on treasury deposits
DROP TRIGGER IF EXISTS trigger_rep_on_deposit ON treasury_deposits;
CREATE TRIGGER trigger_rep_on_deposit
    AFTER INSERT ON treasury_deposits
    FOR EACH ROW
    EXECUTE FUNCTION award_rep_on_deposit();


-- =====================================================
-- 3. AWARD REP WHEN PROPOSAL PASSES
-- Author receives: 50 + total_rep_voted
-- =====================================================

CREATE OR REPLACE FUNCTION award_proposal_author_rep()
RETURNS TRIGGER AS $$
DECLARE
    v_rep_amount INTEGER;
BEGIN
    -- Only trigger when status changes TO 'passed'
    IF NEW.status = 'passed' AND (OLD.status IS NULL OR OLD.status != 'passed') THEN
        -- Calculate REP: 50 base + total rep voted on proposal
        v_rep_amount := 50 + COALESCE(NEW.total_rep_voted, 0);

        -- Award to author
        IF NEW.author_id IS NOT NULL THEN
            UPDATE factory_users
            SET reputation = reputation + v_rep_amount
            WHERE id = NEW.author_id;

            -- Log to history
            INSERT INTO factory_rep_history (user_id, amount, reason, proposal_id)
            VALUES (NEW.author_id, v_rep_amount, 'proposal_passed', NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on proposal status change
DROP TRIGGER IF EXISTS trigger_proposal_passed_rep ON factory_proposals;
CREATE TRIGGER trigger_proposal_passed_rep
    AFTER UPDATE ON factory_proposals
    FOR EACH ROW
    EXECUTE FUNCTION award_proposal_author_rep();


-- =====================================================
-- 4. DEDUCT REP WHEN PROPOSAL REJECTED AS SPAM
-- Author loses 10 REP
-- =====================================================

CREATE OR REPLACE FUNCTION deduct_spam_proposal_rep()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when status changes TO 'rejected' with spam reason
    IF NEW.status = 'rejected'
       AND (OLD.status IS NULL OR OLD.status != 'rejected')
       AND NEW.reject_reason ILIKE '%spam%' THEN

        IF NEW.author_id IS NOT NULL THEN
            -- Deduct REP (minimum 0)
            UPDATE factory_users
            SET reputation = GREATEST(0, reputation - 10)
            WHERE id = NEW.author_id;

            -- Log to history
            INSERT INTO factory_rep_history (user_id, amount, reason, proposal_id)
            VALUES (NEW.author_id, -10, 'spam_rejection', NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on proposal rejection
DROP TRIGGER IF EXISTS trigger_spam_rejection_rep ON factory_proposals;
CREATE TRIGGER trigger_spam_rejection_rep
    AFTER UPDATE ON factory_proposals
    FOR EACH ROW
    EXECUTE FUNCTION deduct_spam_proposal_rep();


-- =====================================================
-- 5. TRIGGER REP DISTRIBUTION ON VAULT VALUE REPORT
-- Automatically distribute REP when yield is reported
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_rep_on_yield()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if value increased (positive yield)
    IF NEW.value_change_usd > 0 THEN
        PERFORM distribute_rep_from_yield();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (enabled - runs after yield calculation)
DROP TRIGGER IF EXISTS auto_rep_from_yield ON vault_value_reports;
CREATE TRIGGER auto_rep_from_yield
    AFTER INSERT ON vault_value_reports
    FOR EACH ROW
    EXECUTE FUNCTION trigger_rep_on_yield();


-- =====================================================
-- 6. AWARD FIRST VOTE BONUS
-- +1 REP for first vote ever cast
-- =====================================================

CREATE OR REPLACE FUNCTION award_first_vote_rep()
RETURNS TRIGGER AS $$
DECLARE
    v_vote_count INTEGER;
BEGIN
    -- Count user's previous votes
    SELECT COUNT(*) INTO v_vote_count
    FROM factory_votes
    WHERE user_id = NEW.user_id
    AND id != NEW.id;

    -- If this is their first vote, award 1 REP
    IF v_vote_count = 0 THEN
        UPDATE factory_users
        SET reputation = reputation + 1
        WHERE id = NEW.user_id;

        INSERT INTO factory_rep_history (user_id, amount, reason, proposal_id)
        VALUES (NEW.user_id, 1, 'first_vote', NEW.proposal_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on first vote
DROP TRIGGER IF EXISTS trigger_first_vote_rep ON factory_votes;
CREATE TRIGGER trigger_first_vote_rep
    AFTER INSERT ON factory_votes
    FOR EACH ROW
    EXECUTE FUNCTION award_first_vote_rep();


-- =====================================================
-- 7. VIEW: REP EARNINGS SUMMARY
-- Shows all rep earning sources for a user
-- =====================================================

CREATE OR REPLACE VIEW rep_earnings_summary AS
SELECT
    u.id AS user_id,
    u.display_name,
    u.reputation AS current_rep,
    COALESCE(SUM(CASE WHEN h.reason = 'treasury_deposit' THEN h.amount ELSE 0 END), 0) AS from_deposits,
    COALESCE(SUM(CASE WHEN h.reason = 'treasury_yield' THEN h.amount ELSE 0 END), 0) AS from_yield,
    COALESCE(SUM(CASE WHEN h.reason = 'proposal_passed' THEN h.amount ELSE 0 END), 0) AS from_proposals,
    COALESCE(SUM(CASE WHEN h.reason = 'first_vote' THEN h.amount ELSE 0 END), 0) AS from_voting,
    COALESCE(SUM(CASE WHEN h.reason = 'founder_bonus' THEN h.amount ELSE 0 END), 0) AS founder_bonus,
    COALESCE(SUM(CASE WHEN h.amount < 0 THEN h.amount ELSE 0 END), 0) AS total_lost,
    COUNT(DISTINCT h.id) AS total_transactions
FROM factory_users u
LEFT JOIN factory_rep_history h ON u.id = h.user_id
GROUP BY u.id, u.display_name, u.reputation;


-- =====================================================
-- USAGE EXAMPLES:
-- =====================================================

-- Manually distribute rep from yield (if not using auto trigger):
-- SELECT * FROM distribute_rep_from_yield();

-- Check user's rep earnings breakdown:
-- SELECT * FROM rep_earnings_summary WHERE user_id = 'uuid-here';

-- View rep history for a user:
-- SELECT * FROM factory_rep_history WHERE user_id = 'uuid-here' ORDER BY created_at DESC;

-- =====================================================
-- DONE! REP System now connects:
-- - Treasury deposits → +1 REP per $1
-- - Treasury yield → +1 REP per $1 earned
-- - Proposal passed → +50 + total_rep_voted to author
-- - First vote → +1 REP
-- - Spam rejection → -10 REP
-- =====================================================
