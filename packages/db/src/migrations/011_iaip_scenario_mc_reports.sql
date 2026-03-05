-- 011: IAIP — Scenario runs + Monte Carlo + Reports
-- Materialized scenario outputs and MC runs; report generation audit.

CREATE TABLE IF NOT EXISTS v3grand.scenario_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  scenario_key VARCHAR(20) NOT NULL,
  label VARCHAR(100),
  inputs_snapshot JSONB NOT NULL,
  outputs JSONB NOT NULL,
  monte_carlo_run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sr_deal ON v3grand.scenario_runs(deal_id);

CREATE TABLE IF NOT EXISTS v3grand.monte_carlo_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  scenario_key VARCHAR(20) NOT NULL DEFAULT 'base',
  iterations INT NOT NULL,
  seed INT,
  outputs JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcr_deal ON v3grand.monte_carlo_runs(deal_id);

CREATE TABLE IF NOT EXISTS v3grand.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  report_type VARCHAR(50) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  file_path VARCHAR(500),
  generated_by VARCHAR(255) NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assumption_snapshot JSONB,
  scenario_key VARCHAR(20)
);

CREATE INDEX IF NOT EXISTS idx_rep_deal ON v3grand.reports(deal_id);

COMMENT ON TABLE v3grand.scenario_runs IS 'IAIP: Scenario run outputs (base/downside/upside)';
COMMENT ON TABLE v3grand.monte_carlo_runs IS 'IAIP FEATURE D: Monte Carlo simulation outputs';
COMMENT ON TABLE v3grand.reports IS 'IAIP: IC memo and report generation audit';
