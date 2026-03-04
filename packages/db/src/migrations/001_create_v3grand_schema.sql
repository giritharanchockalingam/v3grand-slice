-- V3 Grand: create all tables inside a dedicated schema.
-- Run this once against your Supabase instance (SQL editor or via migrate:supabase).
-- Idempotent – safe to re-run.

-- 1. Create the schema
CREATE SCHEMA IF NOT EXISTS v3grand;

-- 2. Tables (mirrors packages/db/src/seed/run.ts DDL)

CREATE TABLE IF NOT EXISTS v3grand.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v3grand.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  asset_class VARCHAR(50) NOT NULL DEFAULT 'hotel',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  lifecycle_phase VARCHAR(50) NOT NULL DEFAULT 'pre-development',
  current_month INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  property JSONB NOT NULL,
  partnership JSONB NOT NULL,
  market_assumptions JSONB NOT NULL,
  financial_assumptions JSONB NOT NULL,
  capex_plan JSONB NOT NULL,
  opex_model JSONB NOT NULL,
  scenarios JSONB NOT NULL,
  active_scenario_key VARCHAR(20) NOT NULL DEFAULT 'base',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v3grand.deal_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES v3grand.users(id),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  role VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, deal_id)
);
CREATE INDEX IF NOT EXISTS da_deal_idx ON v3grand.deal_access(deal_id);
CREATE INDEX IF NOT EXISTS da_user_idx ON v3grand.deal_access(user_id);

CREATE TABLE IF NOT EXISTS v3grand.engine_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  engine_name VARCHAR(50) NOT NULL,
  scenario_key VARCHAR(20) NOT NULL DEFAULT 'base',
  version INTEGER NOT NULL,
  input JSONB NOT NULL,
  output JSONB NOT NULL,
  duration_ms INTEGER NOT NULL,
  triggered_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, engine_name, scenario_key, version)
);
CREATE INDEX IF NOT EXISTS er_deal_engine_scenario_latest ON v3grand.engine_results(deal_id, engine_name, scenario_key, created_at);

CREATE TABLE IF NOT EXISTS v3grand.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  scenario_key VARCHAR(20) NOT NULL DEFAULT 'base',
  version INTEGER NOT NULL,
  verdict VARCHAR(20) NOT NULL,
  confidence INTEGER NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  proforma_snapshot JSONB NOT NULL,
  gate_results JSONB NOT NULL,
  explanation VARCHAR(2000) NOT NULL,
  previous_verdict VARCHAR(20),
  is_flip VARCHAR(5) NOT NULL DEFAULT 'false',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(deal_id, scenario_key, version)
);
CREATE INDEX IF NOT EXISTS rec_deal_scenario_latest ON v3grand.recommendations(deal_id, scenario_key, created_at);

CREATE TABLE IF NOT EXISTS v3grand.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id VARCHAR(255),
  diff JSONB
);
CREATE INDEX IF NOT EXISTS audit_deal_time ON v3grand.audit_log(deal_id, timestamp);

CREATE TABLE IF NOT EXISTS v3grand.budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  cost_code VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  category VARCHAR(100) NOT NULL,
  original_amount DECIMAL(15, 2) NOT NULL,
  approved_cos DECIMAL(15, 2) NOT NULL DEFAULT 0,
  current_budget DECIMAL(15, 2) NOT NULL,
  actual_spend DECIMAL(15, 2) NOT NULL DEFAULT 0,
  commitments DECIMAL(15, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS budget_lines_deal_idx ON v3grand.budget_lines(deal_id);

CREATE TABLE IF NOT EXISTS v3grand.change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  budget_line_id UUID NOT NULL REFERENCES v3grand.budget_lines(id),
  co_number VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  requested_by VARCHAR(255) NOT NULL,
  approved_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS change_orders_deal_idx ON v3grand.change_orders(deal_id);
CREATE INDEX IF NOT EXISTS change_orders_status_idx ON v3grand.change_orders(status);

CREATE TABLE IF NOT EXISTS v3grand.rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  rfi_number VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  question VARCHAR(2000) NOT NULL,
  answer VARCHAR(2000),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  raised_by VARCHAR(255) NOT NULL,
  answered_by VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rfis_deal_idx ON v3grand.rfis(deal_id);
CREATE INDEX IF NOT EXISTS rfis_status_idx ON v3grand.rfis(status);

CREATE TABLE IF NOT EXISTS v3grand.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  name VARCHAR(255) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  target_date VARCHAR(10) NOT NULL,
  actual_date VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'not-started',
  percent_complete INTEGER NOT NULL DEFAULT 0,
  dependencies JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milestones_deal_idx ON v3grand.milestones(deal_id);
CREATE INDEX IF NOT EXISTS milestones_status_idx ON v3grand.milestones(status);

CREATE TABLE IF NOT EXISTS v3grand.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  seq_no INTEGER NOT NULL,
  idempotency_key VARCHAR(255),
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMP,
  UNIQUE(deal_id, seq_no)
);
CREATE INDEX IF NOT EXISTS de_status_idx ON v3grand.domain_events(status);
CREATE UNIQUE INDEX IF NOT EXISTS de_idempotency ON v3grand.domain_events(idempotency_key);

CREATE TABLE IF NOT EXISTS v3grand.risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES v3grand.deals(id),
  title VARCHAR(255) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  category VARCHAR(50) NOT NULL,
  likelihood VARCHAR(20) NOT NULL,
  impact VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  mitigation VARCHAR(2000),
  owner VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS risks_deal_idx ON v3grand.risks(deal_id);
CREATE INDEX IF NOT EXISTS risks_status_idx ON v3grand.risks(status);
