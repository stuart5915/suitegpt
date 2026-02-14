-- Add unique constraint on wallet_address so upsert (ON CONFLICT) works
ALTER TABLE human_profiles
    ADD CONSTRAINT human_profiles_wallet_address_key UNIQUE (wallet_address);
