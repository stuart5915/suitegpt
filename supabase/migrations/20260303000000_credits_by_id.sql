CREATE OR REPLACE FUNCTION add_credits_by_id(target_id uuid, credit_amount integer)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE new_balance integer;
BEGIN
    UPDATE human_profiles SET credits = credits + credit_amount
    WHERE id = target_id RETURNING credits INTO new_balance;
    IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found';
    END IF;
    RETURN new_balance;
END; $$;
