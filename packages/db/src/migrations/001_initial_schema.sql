-- V3 Grand Platform - Initial Database Schema
-- Drizzle-compatible migration for production PostgreSQL
-- Supports multi-user deal management with role-based access, versioning, and alerts

-- Enable UUID extension for ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Create Application Schema ─────────────────────────────────────
-- Isolate V3 Grand tables from other applications
CREATE SCHEMA IF NOT EXISTS v3grand;

-- Set search path for session (optional, for convenience)
SET search_path TO v3grand, public;

-- ─── Users Table ───────────────────────────────────────────────────
-- Core user identity and authentication records
CREATE TABLE IF NOT EXISTS v3grand.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- User identity
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- Account status
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),

    -- Authentication
    password_hash VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Indexes
    CONSTRAINT user_email_unique UNIQUE (email)
);

CREATE INDEX idx_users_email ON v3grand.users (email);
CREATE INDEX idx_users_status ON v3grand.users (status);
CREATE INDEX idx_users_created_at ON v3grand.users (created_at DESC);

-- ─── Deals Table ───────────────────────────────────────────────────
-- Primary deal/investment records with financial tracking
CREATE TABLE IF NOT EXISTS v3grand.deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Deal identity and metadata
    name VARCHAR(255) NOT NULL,
    asset_class VARCHAR(50) NOT NULL CHECK (asset_class IN ('hotel', 'office', 'residential', 'retail', 'industrial', 'mixed-use')),
    description TEXT,

    -- Deal status and lifecycle
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'closed')),
    lifecycle_phase VARCHAR(50) NOT NULL DEFAULT 'initial' CHECK (lifecycle_phase IN ('initial', 'construction', 'stabilized', 'exit')),

    -- Financial data (stored in paisa - smallest currency unit for precision)
    -- BIGINT prevents floating point arithmetic errors in financial calculations
    commitment_amount_paisa BIGINT NOT NULL DEFAULT 0,
    invested_amount_paisa BIGINT NOT NULL DEFAULT 0,
    current_valuation_paisa BIGINT NOT NULL DEFAULT 0,

    -- Deal specifics
    current_month INTEGER DEFAULT 1,
    total_months INTEGER DEFAULT 120,

    -- Versioning for optimistic concurrency control
    version INTEGER NOT NULL DEFAULT 1,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT commitment_positive CHECK (commitment_amount_paisa >= 0),
    CONSTRAINT invested_positive CHECK (invested_amount_paisa >= 0),
    CONSTRAINT valuation_positive CHECK (current_valuation_paisa >= 0)
);

CREATE INDEX idx_deals_status ON v3grand.deals (status);
CREATE INDEX idx_deals_asset_class ON v3grand.deals (asset_class);
CREATE INDEX idx_deals_lifecycle_phase ON v3grand.deals (lifecycle_phase);
CREATE INDEX idx_deals_created_at ON v3grand.deals (created_at DESC);
CREATE INDEX idx_deals_version ON v3grand.deals (version);

-- ─── Deal Access Control (Junction Table) ──────────────────────────
-- Role-based access control for multi-user deal collaboration
CREATE TABLE IF NOT EXISTS v3grand.deal_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign keys
    user_id UUID NOT NULL REFERENCES v3grand.users (id) ON DELETE CASCADE,
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Role-based authorization
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'lead-investor', 'co-investor', 'advisor', 'viewer')),

    -- Permission tracking
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_delete BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT unique_user_deal_access UNIQUE (user_id, deal_id)
);

CREATE INDEX idx_deal_access_user_id ON v3grand.deal_access (user_id);
CREATE INDEX idx_deal_access_deal_id ON v3grand.deal_access (deal_id);
CREATE INDEX idx_deal_access_role ON v3grand.deal_access (role);

-- ─── Alerts Table ──────────────────────────────────────────────────
-- Real-time notifications for deal changes, risks, and milestones
CREATE TABLE IF NOT EXISTS v3grand.alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Alert classification
    type VARCHAR(100) NOT NULL CHECK (type IN ('milestone', 'risk', 'financial', 'deadline', 'approval', 'system')),
    severity VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),

    -- Alert content
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Flexible metadata (for extensibility)
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Acknowledgment tracking
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by UUID REFERENCES v3grand.users (id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_acknowledgment CHECK (
        (acknowledged = false AND acknowledged_by IS NULL AND acknowledged_at IS NULL) OR
        (acknowledged = true AND acknowledged_by IS NOT NULL AND acknowledged_at IS NOT NULL)
    )
);

CREATE INDEX idx_alerts_deal_id ON v3grand.alerts (deal_id);
CREATE INDEX idx_alerts_severity ON v3grand.alerts (severity);
CREATE INDEX idx_alerts_type ON v3grand.alerts (type);
CREATE INDEX idx_alerts_acknowledged ON v3grand.alerts (acknowledged);
CREATE INDEX idx_alerts_created_at ON v3grand.alerts (created_at DESC);

-- ─── Risks Table ───────────────────────────────────────────────────
-- Risk identification and mitigation tracking
CREATE TABLE IF NOT EXISTS v3grand.risks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Risk categorization
    category VARCHAR(100) NOT NULL CHECK (category IN ('market', 'construction', 'operational', 'financial', 'regulatory', 'environmental')),
    severity VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    probability VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (probability IN ('certain', 'high', 'medium', 'low', 'rare')),

    -- Risk details
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_description TEXT,

    -- Mitigation strategy
    mitigation_plan TEXT,
    mitigation_owner UUID REFERENCES v3grand.users (id) ON DELETE SET NULL,

    -- Risk status
    status VARCHAR(50) NOT NULL DEFAULT 'identified' CHECK (status IN ('identified', 'mitigating', 'mitigated', 'closed')),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risks_deal_id ON v3grand.risks (deal_id);
CREATE INDEX idx_risks_category ON v3grand.risks (category);
CREATE INDEX idx_risks_severity ON v3grand.risks (severity);
CREATE INDEX idx_risks_status ON v3grand.risks (status);

-- ─── Deal Versions/Audit Trail ────────────────────────────────────
-- Complete audit history for compliance and rollback capability
CREATE TABLE IF NOT EXISTS v3grand.deal_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Version tracking
    version_number INTEGER NOT NULL,
    changed_by UUID NOT NULL REFERENCES v3grand.users (id) ON DELETE SET NULL,

    -- Change tracking
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('created', 'updated', 'financial', 'status_change')),
    changes_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Snapshot of entire deal state
    deal_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraint
    CONSTRAINT unique_deal_version UNIQUE (deal_id, version_number)
);

CREATE INDEX idx_deal_versions_deal_id ON v3grand.deal_versions (deal_id);
CREATE INDEX idx_deal_versions_version_number ON v3grand.deal_versions (version_number DESC);
CREATE INDEX idx_deal_versions_changed_by ON v3grand.deal_versions (changed_by);
CREATE INDEX idx_deal_versions_created_at ON v3grand.deal_versions (created_at DESC);

-- ─── Deal Metrics Table ────────────────────────────────────────────
-- Financial and operational metrics snapshots for performance tracking
CREATE TABLE IF NOT EXISTS v3grand.deal_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Association to deal
    deal_id UUID NOT NULL REFERENCES v3grand.deals (id) ON DELETE CASCADE,

    -- Metric period
    period_month INTEGER NOT NULL,

    -- Key financial metrics (in paisa)
    revenue_paisa BIGINT DEFAULT 0,
    expenses_paisa BIGINT DEFAULT 0,
    ebitda_paisa BIGINT DEFAULT 0,
    cash_flow_paisa BIGINT DEFAULT 0,

    -- Operational metrics
    occupancy_rate DECIMAL(5,4) CHECK (occupancy_rate >= 0 AND occupancy_rate <= 1),
    adr DECIMAL(10,2),

    -- Performance ratios
    irr DECIMAL(6,4),
    moic DECIMAL(8,4),

    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deal_metrics_deal_id ON v3grand.deal_metrics (deal_id);
CREATE INDEX idx_deal_metrics_period_month ON v3grand.deal_metrics (period_month);
CREATE UNIQUE INDEX idx_deal_metrics_unique_period ON v3grand.deal_metrics (deal_id, period_month);

-- ─── Grant Permissions ────────────────────────────────────────────
-- Allow application role to access schema (update with actual app user)
-- GRANT USAGE ON SCHEMA v3grand TO v3grand;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA v3grand TO v3grand;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA v3grand TO v3grand;

-- Reset search path to default
SET search_path TO public;
