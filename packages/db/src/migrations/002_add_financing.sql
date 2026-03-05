-- V3 Grand Platform - Financing Plans and Debt Structure
-- Extension to initial schema for multi-tranche debt and equity modeling
-- Supports complex capital structures with draw requests and disbursement tracking

-- ─── Financing Plans Table ──────────────────────────────────────
-- High-level financing structure for each deal
CREATE TABLE IF NOT EXISTS v3grand.financing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal
    deal_id UUID NOT NULL UNIQUE REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Financing structure overview (in paisa)
    total_debt_paisa BIGINT NOT NULL DEFAULT 0,
    total_equity_paisa BIGINT NOT NULL DEFAULT 0,

    -- Key financial ratios
    ltv_ratio DECIMAL(5,4) NOT NULL DEFAULT 0.5 CHECK (ltv_ratio >= 0 AND ltv_ratio <= 1),

    -- Flexible structure metadata (for various deal types)
    debt_structure JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT debt_positive CHECK (total_debt_paisa >= 0),
    CONSTRAINT equity_positive CHECK (total_equity_paisa >= 0)
);

CREATE INDEX idx_financing_plans_deal_id ON v3grand.financing_plans (deal_id);
CREATE INDEX idx_financing_plans_created_at ON v3grand.financing_plans (created_at DESC);

-- ─── Debt Tranches Table ────────────────────────────────────────
-- Individual debt instruments within a financing plan
-- Supports waterfall, pari-passu, or custom debt structures
CREATE TABLE IF NOT EXISTS v3grand.debt_tranches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to financing plan
    financing_plan_id UUID NOT NULL REFERENCES v3grand.financing_plans (id) ON DELETE CASCADE,

    -- Tranche identity
    name VARCHAR(255) NOT NULL,
    tranche_type VARCHAR(100) NOT NULL CHECK (tranche_type IN ('senior', 'mezzanine', 'subordinated', 'preferred-equity')),

    -- Financial terms (in paisa)
    amount_committed_paisa BIGINT NOT NULL DEFAULT 0,
    amount_drawn_paisa BIGINT NOT NULL DEFAULT 0,

    -- Pricing and terms
    interest_rate DECIMAL(6,4) NOT NULL CHECK (interest_rate >= 0),
    tenor_years INTEGER NOT NULL CHECK (tenor_years > 0),

    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'fully-drawn', 'in-repayment', 'fully-repaid', 'defaulted')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT amount_positive CHECK (amount_committed_paisa >= 0),
    CONSTRAINT drawn_le_committed CHECK (amount_drawn_paisa <= amount_committed_paisa)
);

CREATE INDEX idx_debt_tranches_financing_plan_id ON v3grand.debt_tranches (financing_plan_id);
CREATE INDEX idx_debt_tranches_tranche_type ON v3grand.debt_tranches (tranche_type);
CREATE INDEX idx_debt_tranches_status ON v3grand.debt_tranches (status);
CREATE INDEX idx_debt_tranches_created_at ON v3grand.debt_tranches (created_at DESC);

-- ─── Draw Requests Table ────────────────────────────────────────
-- Track capital draws from committed tranches
-- Provides visibility into drawdown schedule and approval workflow
CREATE TABLE IF NOT EXISTS v3grand.draw_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal and tranche
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,
    tranche_id UUID NOT NULL REFERENCES v3grand.debt_tranches (id) ON DELETE CASCADE,

    -- Draw request details
    amount_requested_paisa BIGINT NOT NULL,
    amount_approved_paisa BIGINT NOT NULL DEFAULT 0,

    -- Request status
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disbursed', 'reversed')),

    -- Approval workflow
    submitted_by UUID NOT NULL REFERENCES v3grand.users (id) ON DELETE SET NULL,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    approved_by UUID REFERENCES v3grand.users (id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,

    rejected_by UUID REFERENCES v3grand.users (id) ON DELETE SET NULL,
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,

    -- Disbursement tracking
    disbursed_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT amount_requested_positive CHECK (amount_requested_paisa > 0),
    CONSTRAINT amount_approved_positive CHECK (amount_approved_paisa >= 0),
    CONSTRAINT approved_le_requested CHECK (amount_approved_paisa <= amount_requested_paisa),
    CONSTRAINT approval_consistency CHECK (
        (status = 'pending' AND approved_by IS NULL AND approved_at IS NULL) OR
        (status IN ('approved', 'disbursed') AND approved_by IS NOT NULL AND approved_at IS NOT NULL) OR
        (status IN ('rejected', 'reversed') AND rejected_by IS NOT NULL AND rejected_at IS NOT NULL) OR
        (status = 'pending' AND rejected_by IS NULL)
    )
);

CREATE INDEX idx_draw_requests_deal_id ON v3grand.draw_requests (deal_id);
CREATE INDEX idx_draw_requests_tranche_id ON v3grand.draw_requests (tranche_id);
CREATE INDEX idx_draw_requests_status ON v3grand.draw_requests (status);
CREATE INDEX idx_draw_requests_submitted_by ON v3grand.draw_requests (submitted_by);
CREATE INDEX idx_draw_requests_approved_by ON v3grand.draw_requests (approved_by);
CREATE INDEX idx_draw_requests_created_at ON v3grand.draw_requests (created_at DESC);
CREATE INDEX idx_draw_requests_submitted_at ON v3grand.draw_requests (submitted_at DESC);

-- ─── Equity Structure Table ─────────────────────────────────────
-- Track equity commitments and investor positions
-- Complements debt tranches for complete capital structure visibility
CREATE TABLE IF NOT EXISTS v3grand.equity_investors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Investor identity
    investor_name VARCHAR(255) NOT NULL,
    investor_entity_id UUID REFERENCES v3grand.users (id) ON DELETE SET NULL,

    -- Equity commitment
    committed_amount_paisa BIGINT NOT NULL,
    invested_amount_paisa BIGINT NOT NULL DEFAULT 0,
    ownership_percentage DECIMAL(6,4) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 1),

    -- Equity terms
    preferred BOOLEAN NOT NULL DEFAULT false,
    liquidation_preference VARCHAR(100),

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'invested', 'exited', 'defaulted')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT committed_positive CHECK (committed_amount_paisa > 0),
    CONSTRAINT invested_positive CHECK (invested_amount_paisa >= 0),
    CONSTRAINT invested_le_committed CHECK (invested_amount_paisa <= committed_amount_paisa)
);

CREATE INDEX idx_equity_investors_deal_id ON v3grand.equity_investors (deal_id);
CREATE INDEX idx_equity_investors_investor_entity_id ON v3grand.equity_investors (investor_entity_id);
CREATE INDEX idx_equity_investors_status ON v3grand.equity_investors (status);
CREATE INDEX idx_equity_investors_created_at ON v3grand.equity_investors (created_at DESC);
CREATE UNIQUE INDEX idx_equity_investors_unique_investor ON v3grand.equity_investors (deal_id, investor_entity_id)
    WHERE investor_entity_id IS NOT NULL;
