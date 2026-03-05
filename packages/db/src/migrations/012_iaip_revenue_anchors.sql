-- 012: IAIP — Revenue anchors (hotel + mixed-use)
-- Anchor types with capex, opex, revenue lines, phase.

CREATE TABLE IF NOT EXISTS v3grand.revenue_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  anchor_type VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  capex DECIMAL(18,2) NOT NULL DEFAULT 0,
  opex_annual DECIMAL(18,2) NOT NULL DEFAULT 0,
  revenue_lines JSONB NOT NULL DEFAULT '[]',
  phase INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ra_deal ON v3grand.revenue_anchors(deal_id);

COMMENT ON TABLE v3grand.revenue_anchors IS 'IAIP: Revenue anchor optimizer (rooms, F&B, banquet, spa, retail, etc.)';
