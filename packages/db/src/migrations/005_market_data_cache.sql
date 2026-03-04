-- 005: Market Data Cache table for MCP Market Intelligence
-- Stores cached responses from RBI, World Bank, FRED, data.gov.in

CREATE TABLE IF NOT EXISTS market_data_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  source TEXT NOT NULL,          -- 'rbi' | 'world_bank' | 'fred' | 'data_gov_in' | 'multi-source'
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mdc_expires ON market_data_cache (expires_at);
