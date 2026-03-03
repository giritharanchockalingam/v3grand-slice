// ─── Drizzle ORM Schema (Vertical Slice) ───────────────────────────
import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex, index, boolean, decimal } from 'drizzle-orm/pg-core';

// ── Users ──
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('viewer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// ── Deals ──
export const deals = pgTable('deals', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  name:                varchar('name', { length: 255 }).notNull(),
  assetClass:          varchar('asset_class', { length: 50 }).notNull().default('hotel'),
  status:              varchar('status', { length: 20 }).notNull().default('draft'),
  lifecyclePhase:      varchar('lifecycle_phase', { length: 50 }).notNull().default('pre-development'),
  currentMonth:        integer('current_month').notNull().default(0),
  version:             integer('version').notNull().default(1),
  property:            jsonb('property').notNull(),
  partnership:         jsonb('partnership').notNull(),
  marketAssumptions:   jsonb('market_assumptions').notNull(),
  financialAssumptions:jsonb('financial_assumptions').notNull(),
  capexPlan:           jsonb('capex_plan').notNull(),
  opexModel:           jsonb('opex_model').notNull(),
  scenarios:           jsonb('scenarios').notNull(),
  activeScenarioKey:   varchar('active_scenario_key', { length: 20 }).notNull().default('base'),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  updatedAt:           timestamp('updated_at').notNull().defaultNow(),
});

// ── Engine Results (versioned, append-only) ──
export const engineResults = pgTable('engine_results', {
  id:          uuid('id').primaryKey().defaultRandom(),
  dealId:      uuid('deal_id').notNull().references(() => deals.id),
  engineName:  varchar('engine_name', { length: 50 }).notNull(),
  scenarioKey: varchar('scenario_key', { length: 20 }).notNull().default('base'),
  version:     integer('version').notNull(),
  input:       jsonb('input').notNull(),
  output:      jsonb('output').notNull(),
  durationMs:  integer('duration_ms').notNull(),
  triggeredBy: varchar('triggered_by', { length: 100 }).notNull(),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueVersion: uniqueIndex('er_deal_engine_scenario_version').on(t.dealId, t.engineName, t.scenarioKey, t.version),
  latestIdx:     index('er_deal_engine_scenario_latest').on(t.dealId, t.engineName, t.scenarioKey, t.createdAt),
}));

// ── Recommendations (versioned, append-only) ──
export const recommendations = pgTable('recommendations', {
  id:               uuid('id').primaryKey().defaultRandom(),
  dealId:           uuid('deal_id').notNull().references(() => deals.id),
  scenarioKey:      varchar('scenario_key', { length: 20 }).notNull().default('base'),
  version:          integer('version').notNull(),
  verdict:          varchar('verdict', { length: 20 }).notNull(),
  confidence:       integer('confidence').notNull(),
  triggerEvent:     varchar('trigger_event', { length: 100 }).notNull(),
  proformaSnapshot: jsonb('proforma_snapshot').notNull(),
  gateResults:      jsonb('gate_results').notNull(),
  explanation:      varchar('explanation', { length: 2000 }).notNull(),
  previousVerdict:  varchar('previous_verdict', { length: 20 }),
  isFlip:           varchar('is_flip', { length: 5 }).notNull().default('false'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueVersion: uniqueIndex('rec_deal_scenario_version').on(t.dealId, t.scenarioKey, t.version),
  latestIdx:     index('rec_deal_scenario_latest').on(t.dealId, t.scenarioKey, t.createdAt),
}));

// ── Audit Log ──
export const auditLog = pgTable('audit_log', {
  id:         uuid('id').primaryKey().defaultRandom(),
  timestamp:  timestamp('timestamp').notNull().defaultNow(),
  dealId:     uuid('deal_id').notNull().references(() => deals.id),
  userId:     varchar('user_id', { length: 255 }).notNull(),
  role:       varchar('role', { length: 50 }).notNull(),
  module:     varchar('module', { length: 50 }).notNull(),
  action:     varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }),
  entityId:   varchar('entity_id', { length: 255 }),
  diff:       jsonb('diff'),
}, (t) => ({
  dealTimeIdx: index('audit_deal_time').on(t.dealId, t.timestamp),
}));

// ── Construction: Budget Lines ──
export const budgetLines = pgTable('budget_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  costCode: varchar('cost_code', { length: 50 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  originalAmount: decimal('original_amount', { precision: 15, scale: 2 }).notNull(),
  approvedCOs: decimal('approved_cos', { precision: 15, scale: 2 }).notNull().default('0'),
  currentBudget: decimal('current_budget', { precision: 15, scale: 2 }).notNull(),
  actualSpend: decimal('actual_spend', { precision: 15, scale: 2 }).notNull().default('0'),
  commitments: decimal('commitments', { precision: 15, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dealIdx: index('budget_lines_deal_idx').on(t.dealId),
}));

// ── Construction: Change Orders ──
export const changeOrders = pgTable('change_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  budgetLineId: uuid('budget_line_id').notNull().references(() => budgetLines.id),
  coNumber: varchar('co_number', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }).notNull(),
  amount: decimal('amount', { precision: 15, scale: 2 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  requestedBy: varchar('requested_by', { length: 255 }).notNull(),
  approvedBy: varchar('approved_by', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dealIdx: index('change_orders_deal_idx').on(t.dealId),
  statusIdx: index('change_orders_status_idx').on(t.status),
}));

// ── Construction: RFIs ──
export const rfis = pgTable('rfis', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  rfiNumber: varchar('rfi_number', { length: 50 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  question: varchar('question', { length: 2000 }).notNull(),
  answer: varchar('answer', { length: 2000 }),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  raisedBy: varchar('raised_by', { length: 255 }).notNull(),
  answeredBy: varchar('answered_by', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dealIdx: index('rfis_deal_idx').on(t.dealId),
  statusIdx: index('rfis_status_idx').on(t.status),
}));

// ── Construction: Milestones ──
export const milestones = pgTable('milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  name: varchar('name', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }).notNull(),
  targetDate: varchar('target_date', { length: 10 }).notNull(), // YYYY-MM-DD
  actualDate: varchar('actual_date', { length: 10 }),
  status: varchar('status', { length: 20 }).notNull().default('not-started'),
  percentComplete: integer('percent_complete').notNull().default(0),
  dependencies: jsonb('dependencies').notNull().default('[]'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dealIdx: index('milestones_deal_idx').on(t.dealId),
  statusIdx: index('milestones_status_idx').on(t.status),
}));

// ── Domain Events (write-ahead log for event sourcing) ──
export const domainEvents = pgTable('domain_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  type: varchar('type', { length: 100 }).notNull(),      // e.g. "assumption.updated", "change-order.approved"
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),  // PENDING | PROCESSED | FAILED | DEAD_LETTER
  seqNo: integer('seq_no').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 255 }),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
}, (t) => ({
  dealSeq: uniqueIndex('de_deal_seq').on(t.dealId, t.seqNo),
  statusIdx: index('de_status_idx').on(t.status),
  idempotency: uniqueIndex('de_idempotency').on(t.idempotencyKey),
}));
