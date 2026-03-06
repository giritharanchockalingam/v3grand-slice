// ─── Centralized Test Data & Constants ──────────────────────────────

export const BASE_URL = process.env.E2E_BASE_URL || 'https://v3grand-slice.vercel.app';

/** Known seeded deal */
export const DEAL_ID = '00000000-0000-7000-8000-000000000001';
export const DEAL_NAME = 'V3 Grand Madurai';
export const DEAL_URL = `/deals/${DEAL_ID}`;

/** Demo credentials */
export const DEMO_ACCOUNTS = {
  lead:   { email: 'lead@v3grand.com',   password: 'demo123', name: 'Alice Lead',   role: 'lead-investor', label: 'Lead Investor' },
  co:     { email: 'co@v3grand.com',     password: 'demo123', name: 'Bob Co',       role: 'co-investor',   label: 'Co-Investor' },
  ops:    { email: 'ops@v3grand.com',    password: 'demo123', name: 'Charlie Ops',  role: 'operator',      label: 'Operator' },
  viewer: { email: 'viewer@v3grand.com', password: 'demo123', name: 'Diana Viewer', role: 'viewer',        label: 'Viewer' },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;

/** All 10 deal-detail tab labels as displayed in the UI */
export const TAB_LABELS = [
  'Dashboard', 'Underwriting', 'Construction', 'Risks',
  'Assumptions', 'Feasibility', 'Market Intel', 'What-If',
  'Revaluation', 'Audit Trail',
] as const;

/** Cash-flow table column headers */
export const CASH_FLOW_COLUMNS = [
  'Year', 'Occupancy', 'ADR', 'RevPAR', 'Revenue',
  'GOP', 'GOP%', 'EBITDA', 'EBITDA%', 'Debt Service', 'FCFE',
] as const;

/** Portfolio table column headers */
export const PORTFOLIO_COLUMNS = [
  'Name', 'Phase', 'Month', 'IRR', 'NPV', 'Equity Multiple', 'DSCR', 'Verdict',
] as const;

/** Construction budget-line table column headers */
export const BUDGET_LINE_COLUMNS = [
  'Cost Code', 'Description', 'Category', 'Original', 'COs',
  'Current Budget', 'Actual', 'Committed', 'Variance',
] as const;

/** Valid recommendation verdicts */
export const VALID_VERDICTS = ['INVEST', 'HOLD', 'DE-RISK', 'EXIT', 'DO-NOT-PROCEED'] as const;

/** Seeded deal names (at least these should appear in the deals list) */
export const SEEDED_DEAL_NAMES = [
  'V3 Grand Madurai',
  'Mumbai Luxury Resort',
  'Bangalore Tech Park Hotel',
  'Chennai Business Hotel',
] as const;

/** Assumption slider labels (Revenue Drivers) */
export const REVENUE_ASSUMPTION_LABELS = [
  'Base ADR',
  'Stabilized ADR',
  'ADR Growth Rate',
] as const;

/** Assumption slider labels (Financial) */
export const FINANCIAL_ASSUMPTION_LABELS = [
  'Debt Ratio',
  'Interest Rate',
  'Debt Tenor',
  'Exit Multiple',
  'WACC',
  'Target IRR',
  'Management Fee',
  'Incentive Fee',
  'FF&E Reserve',
  'Tax Rate',
  'Inflation Rate',
] as const;
