-- UBI Whale Cap: per-wallet cap on daily distribution + redirect preferences

ALTER TABLE inclawbate_ubi_treasury
  ADD COLUMN IF NOT EXISTS wallet_cap_pct numeric NOT NULL DEFAULT 10;

ALTER TABLE human_profiles
  ADD COLUMN IF NOT EXISTS ubi_whale_redirect_pct numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ubi_whale_redirect_target text
    CHECK (ubi_whale_redirect_target IN ('philanthropy', 'reinvest'));
