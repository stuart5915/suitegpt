-- Prayer Wall tables (run on main SUITE Supabase: rdsmdywbdiskxknluiym)

CREATE TABLE IF NOT EXISTS prayer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    display_name TEXT,
    prayer_text TEXT NOT NULL,
    pray_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prayer_requests_created ON prayer_requests(created_at DESC);
ALTER TABLE prayer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read" ON prayer_requests FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS prayer_prays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    prayer_id UUID NOT NULL REFERENCES prayer_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, prayer_id)
);
ALTER TABLE prayer_prays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read" ON prayer_prays FOR SELECT USING (true);

-- Auto-update pray_count
CREATE OR REPLACE FUNCTION update_pray_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE prayer_requests SET pray_count = pray_count + 1 WHERE id = NEW.prayer_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE prayer_requests SET pray_count = pray_count - 1 WHERE id = OLD.prayer_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE TRIGGER on_pray_change AFTER INSERT OR DELETE ON prayer_prays
FOR EACH ROW EXECUTE FUNCTION update_pray_count();
