-- 010: IAIP — Assumption governance (FEATURE E: AGAT)
-- Every model input as assumption with owner, rationale, source, confidence, status.

CREATE TABLE IF NOT EXISTS v3grand.assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  assumption_key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  unit VARCHAR(20),
  owner VARCHAR(255) NOT NULL,
  rationale VARCHAR(2000),
  source VARCHAR(255),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  last_reviewed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(deal_id, assumption_key)
);

CREATE INDEX IF NOT EXISTS idx_assump_deal_status ON v3grand.assumptions(deal_id, status);

COMMENT ON TABLE v3grand.assumptions IS 'IAIP FEATURE E: Assumption governance Draft→Reviewed→Approved→Locked';
