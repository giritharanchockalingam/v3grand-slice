-- 009: IAIP — Forecast models + runs (FEATURE B: Backtesting / Calibration)
-- Versioned models and forecast runs with metrics (MAPE, RMSE).

CREATE TABLE IF NOT EXISTS v3grand.forecast_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  target_metric VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, version)
);

CREATE INDEX IF NOT EXISTS idx_fm_target ON v3grand.forecast_models(target_metric);

CREATE TABLE IF NOT EXISTS v3grand.forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  model_id UUID NOT NULL REFERENCES v3grand.forecast_models(id),
  scenario_key VARCHAR(20) NOT NULL DEFAULT 'base',
  input_snapshot JSONB NOT NULL,
  output JSONB NOT NULL,
  metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fr_deal ON v3grand.forecast_runs(deal_id);
CREATE INDEX IF NOT EXISTS idx_fr_model ON v3grand.forecast_runs(model_id);

COMMENT ON TABLE v3grand.forecast_models IS 'IAIP FEATURE B: Versioned forecast models for backtesting';
COMMENT ON TABLE v3grand.forecast_runs IS 'IAIP FEATURE B: Forecast run outputs and error metrics';
