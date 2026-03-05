-- Enterprise: optional market and macro snapshots at deal creation (audit trail).
-- Idempotent – safe to re-run.

ALTER TABLE v3grand.deals
  ADD COLUMN IF NOT EXISTS market_snapshot_at_create JSONB,
  ADD COLUMN IF NOT EXISTS macro_snapshot_at_create JSONB;

COMMENT ON COLUMN v3grand.deals.market_snapshot_at_create IS 'Snapshot of city profile / demand / construction at deal creation';
COMMENT ON COLUMN v3grand.deals.macro_snapshot_at_create IS 'Snapshot of macro indicators (repo rate, CPI, FX) at deal creation';
