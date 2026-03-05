-- 008: IAIP — Market metrics + data lineage (FEATURE A: DQ/NL)
-- Normalized metrics with source, confidence, and lineage for auditability.

CREATE TABLE IF NOT EXISTS v3grand.market_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES v3grand.deals(id),
  location_id VARCHAR(100),
  metric_key VARCHAR(100) NOT NULL,
  value DECIMAL(18,6) NOT NULL,
  unit VARCHAR(20),
  as_of_date DATE NOT NULL,
  source VARCHAR(100) NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
  lineage_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_deal_location ON v3grand.market_metrics(deal_id, location_id);
CREATE INDEX IF NOT EXISTS idx_mm_key_as_of ON v3grand.market_metrics(metric_key, as_of_date);

CREATE TABLE IF NOT EXISTS v3grand.data_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  source_system VARCHAR(100) NOT NULL,
  source_id VARCHAR(255),
  transformation VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dl_entity ON v3grand.data_lineage(entity_type, entity_id);

COMMENT ON TABLE v3grand.market_metrics IS 'IAIP FEATURE A: Normalized market metrics with source and confidence';
COMMENT ON TABLE v3grand.data_lineage IS 'IAIP FEATURE A: Lineage for entities (property, metric, etc.)';
