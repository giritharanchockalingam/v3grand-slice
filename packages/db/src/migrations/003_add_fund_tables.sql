-- 003: Fund Administration Tables (LP Portal, Waterfall, K-1)

-- Fund entity
CREATE TABLE IF NOT EXISTS funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  vintage_year INT NOT NULL,
  target_size_paisa BIGINT NOT NULL,
  committed_capital_paisa BIGINT NOT NULL DEFAULT 0,
  preferred_return NUMERIC(5,4) NOT NULL DEFAULT 0.0800,
  gp_carry NUMERIC(5,4) NOT NULL DEFAULT 0.2000,
  catch_up_rate NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'liquidating')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- LP/Investor registry
CREATE TABLE IF NOT EXISTS deal_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  investor_name TEXT NOT NULL,
  investor_type TEXT NOT NULL CHECK (investor_type IN ('LP', 'GP', 'Co-Invest', 'Anchor')),
  ownership_pct NUMERIC(7,4) NOT NULL,
  committed_amount_paisa BIGINT NOT NULL,
  called_amount_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Capital calls
CREATE TABLE IF NOT EXISTS capital_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  fund_id UUID REFERENCES funds(id),
  investor_id UUID NOT NULL REFERENCES deal_investors(id),
  amount BIGINT NOT NULL,
  call_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Distributions
CREATE TABLE IF NOT EXISTS distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  fund_id UUID REFERENCES funds(id),
  investor_id UUID NOT NULL REFERENCES deal_investors(id),
  amount BIGINT NOT NULL,
  distribution_type TEXT NOT NULL CHECK (distribution_type IN ('return_of_capital', 'preferred', 'profit', 'special')),
  distribution_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fund assets for NAV calculation
CREATE TABLE IF NOT EXISTS fund_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  deal_id UUID REFERENCES deals(id),
  asset_type TEXT NOT NULL,
  current_valuation BIGINT NOT NULL,
  valuation_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fund liabilities
CREATE TABLE IF NOT EXISTS fund_liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  liability_type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fund units for NAV per unit
CREATE TABLE IF NOT EXISTS fund_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  investor_id UUID NOT NULL REFERENCES deal_investors(id),
  units NUMERIC(18,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- K-1 tax allocations
CREATE TABLE IF NOT EXISTS fund_investor_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds(id),
  investor_id UUID NOT NULL REFERENCES deal_investors(id),
  tax_year INT NOT NULL,
  ordinary_income BIGINT NOT NULL DEFAULT 0,
  capital_gains_st BIGINT NOT NULL DEFAULT 0,
  capital_gains_lt BIGINT NOT NULL DEFAULT 0,
  depreciation BIGINT NOT NULL DEFAULT 0,
  interest_expense BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(fund_id, investor_id, tax_year)
);

-- Budget lines for construction tracking
CREATE TABLE IF NOT EXISTS budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id),
  cost_code TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  original_amount BIGINT NOT NULL,
  approved_cos BIGINT NOT NULL DEFAULT 0,
  current_budget BIGINT NOT NULL,
  actual_spend BIGINT NOT NULL DEFAULT 0,
  commitments BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deal_investors_deal ON deal_investors(deal_id);
CREATE INDEX IF NOT EXISTS idx_capital_calls_investor ON capital_calls(investor_id);
CREATE INDEX IF NOT EXISTS idx_distributions_investor ON distributions(investor_id);
CREATE INDEX IF NOT EXISTS idx_fund_assets_fund ON fund_assets(fund_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_deal ON budget_lines(deal_id);
CREATE INDEX IF NOT EXISTS idx_fund_allocations_fund_year ON fund_investor_allocations(fund_id, tax_year);
