-- Enterprise / Big 4: capture context at deal creation (deal type, source, strategic intent, bands).
-- Idempotent – safe to re-run.

ALTER TABLE v3grand.deals
  ADD COLUMN IF NOT EXISTS capture_context JSONB;

COMMENT ON COLUMN v3grand.deals.capture_context IS 'Deal type (new/revamp/restructure), source, strategic intent, target return band, investment size band – for engines and audit';
