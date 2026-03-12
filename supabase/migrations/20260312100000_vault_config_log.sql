-- Vault config change log
-- Records every time a manager updates their vault's configuration

CREATE TABLE IF NOT EXISTS vault_config_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vault_address TEXT NOT NULL REFERENCES vault_marketplace(vault_address),
    changed_by TEXT NOT NULL,  -- wallet address
    change_type TEXT NOT NULL, -- 'allocation', 'lp_params', 'deposit_cap', 'description', 'brain_config'
    old_value JSONB DEFAULT '{}',
    new_value JSONB DEFAULT '{}',
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vault_config_log_vault ON vault_config_log(vault_address, created_at DESC);

ALTER TABLE vault_config_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read config log" ON vault_config_log FOR SELECT USING (true);
CREATE POLICY "Service role can insert config log" ON vault_config_log FOR INSERT WITH CHECK (true);
