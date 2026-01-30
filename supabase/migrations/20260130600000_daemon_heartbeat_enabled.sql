-- Add enabled toggle column to daemon_heartbeat for pause/resume from UI
ALTER TABLE daemon_heartbeat
    ADD COLUMN IF NOT EXISTS enabled boolean DEFAULT true;
