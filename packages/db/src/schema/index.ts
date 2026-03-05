// ─── Drizzle ORM Schema (Vertical Slice) ───────────────────────────
import { pgTable, uuid, varchar, integer, jsonb, timestamp, uniqueIndex, index, boolean, decimal } from 'drizzle-orm/pg-core';

// ── Users ──
// G-3/F-14: Added soft delete (deletedAt) and data retention fields for DPDP/GDPR compliance
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('viewer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),                          // G-3: Soft delete
  dataRetentionExpiresAt: timestamp('data_retention_expires_at'), // G-3: Auto-purge date
  consentGiven: boolean('consent_given').notNull().default(false),
  consentTimestamp: timestamp('consent_timestamp'),
});

// ── Deal Access (per-user, per-deal role mapping) ──
export const dealAccess = pgTable('deal_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  role: varchar('role', { length: 50 }).notNull(), // role on this specific deal
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueUserDeal: uniqueIndex('da_user_deal').on(t.userId, t.dealId),
  dealIdx: index('da_deal_idx').on(t.dealId),
  userIdx: index('da_user_idx').on(t.userId),
}));

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
  marketSnapshotAtCreate: jsonb('market_snapshot_at_create'),
  macroSnapshotAtCreate:  jsonb('macro_snapshot_at_create'),
  captureContext:        jsonb('capture_context'),
  createdAt:             timestamp('created_at').notNull().defaultNow(),
  updatedAt:             timestamp('updated_at').notNull().defaultNow(),
});

// ── Engine Results (versioned, append-only, hash-chained for tamper evidence) ──
// G-2/F-3: Cryptographic hash chain — each result contains SHA-256 of its predecessor
// G-10/F-4: Model version registry — tracks which engine code version produced each result
export const engineResults = pgTable('engine_results', {
  id:            uuid('id').primaryKey().defaultRandom(),
  dealId:        uuid('deal_id').notNull().references(() => deals.id),
  engineName:    varchar('engine_name', { length: 50 }).notNull(),
  scenarioKey:   varchar('scenario_key', { length: 20 }).notNull().default('base'),
  version:       integer('version').notNull(),
  input:         jsonb('input').notNull(),
  output:        jsonb('output').notNull(),
  durationMs:    integer('duration_ms').notNull(),
  triggeredBy:   varchar('triggered_by', { length: 100 }).notNull(),
  // G-2: Hash chain for tamper-evidence (SHA-256 of previousHash + engineName + version + input + output)
  contentHash:   varchar('content_hash', { length: 64 }).notNull().default('genesis'),
  previousHash:  varchar('previous_hash', { length: 64 }).notNull().default('genesis'),
  // G-10: Model version registry — semantic version or git commit of engine code
  modelVersion:  varchar('model_version', { length: 50 }).notNull().default('1.0.0'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  uniqueVersion: uniqueIndex('er_deal_engine_scenario_version').on(t.dealId, t.engineName, t.scenarioKey, t.version),
  latestIdx:     index('er_deal_engine_scenario_latest').on(t.dealId, t.engineName, t.scenarioKey, t.createdAt),
  hashIdx:       index('er_content_hash_idx').on(t.contentHash),
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

// ── Market Data Cache (MCP) ──
export const marketDataCache = pgTable('market_data_cache', {
  key: varchar('key', { length: 255 }).primaryKey(),
  value: jsonb('value').notNull(),
  source: varchar('source', { length: 50 }).notNull(),       // 'rbi' | 'world_bank' | 'fred' | 'data_gov_in' | 'multi-source'
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
}, (t) => ({
  expiresIdx: index('mdc_expires_idx').on(t.expiresAt),
}));

// ── G-4/F-8: Market Data History (append-only audit trail for every market data fetch) ──
// Enables auditors to trace "on date X, the system used repo rate Y from source Z"
export const marketDataHistory = pgTable('market_data_history', {
  id:            uuid('id').primaryKey().defaultRandom(),
  indicator:     varchar('indicator', { length: 100 }).notNull(), // 'repoRate' | 'cpi' | 'usdInr' | 'gdpGrowth' | etc.
  value:         decimal('value', { precision: 18, scale: 6 }).notNull(),
  asOfDate:      varchar('as_of_date', { length: 30 }).notNull(), // the date the data refers to
  source:        varchar('source', { length: 100 }).notNull(),     // 'rbi-official' | 'fred-api' | 'exchangerate-api' | etc.
  sourceType:    varchar('source_type', { length: 20 }).notNull(), // 'live-api' | 'official' | 'fallback'
  previousValue: decimal('previous_value', { precision: 18, scale: 6 }),
  changeReason:  varchar('change_reason', { length: 255 }),        // e.g. 'MPC rate cut', 'monthly CPI release'
  fetchedAt:     timestamp('fetched_at').notNull().defaultNow(),
}, (t) => ({
  indicatorIdx: index('mdh_indicator_idx').on(t.indicator, t.fetchedAt),
  sourceIdx:    index('mdh_source_idx').on(t.source),
}));

// ── G-11/F-2: Pending Actions (Four-Eyes / Maker-Checker Approval Workflow) ──
// Critical actions require approval from a user with a different role than the initiator.
export const pendingActions = pgTable('pending_actions', {
  id:            uuid('id').primaryKey().defaultRandom(),
  dealId:        uuid('deal_id').notNull().references(() => deals.id),
  actionType:    varchar('action_type', { length: 50 }).notNull(), // 'assumption.update' | 'scenario.promote' | 'revalue' | 'deal.status'
  status:        varchar('status', { length: 20 }).notNull().default('PENDING'), // PENDING | APPROVED | REJECTED | EXPIRED
  // Who initiated
  initiatorId:   varchar('initiator_id', { length: 255 }).notNull(),
  initiatorRole: varchar('initiator_role', { length: 50 }).notNull(),
  // Who approved/rejected
  reviewerId:    varchar('reviewer_id', { length: 255 }),
  reviewerRole:  varchar('reviewer_role', { length: 50 }),
  reviewedAt:    timestamp('reviewed_at'),
  reviewNote:    varchar('review_note', { length: 1000 }),
  // Payload of the action to be taken upon approval
  payload:       jsonb('payload').notNull(),
  // Materiality assessment — low = auto-approve, medium = peer review, high = senior review
  materiality:   varchar('materiality', { length: 20 }).notNull().default('medium'),
  expiresAt:     timestamp('expires_at').notNull(), // pending actions expire after 7 days
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  dealStatusIdx: index('pa_deal_status_idx').on(t.dealId, t.status),
  initiatorIdx:  index('pa_initiator_idx').on(t.initiatorId),
  expiresIdx:    index('pa_expires_idx').on(t.expiresAt),
}));

// ── G-9/F-1: Model Validation Results (back-testing & benchmarking) ──
export const modelValidationResults = pgTable('model_validation_results', {
  id:             uuid('id').primaryKey().defaultRandom(),
  engineName:     varchar('engine_name', { length: 50 }).notNull(),
  modelVersion:   varchar('model_version', { length: 50 }).notNull(),
  validationType: varchar('validation_type', { length: 50 }).notNull(), // 'backtest' | 'benchmark' | 'sensitivity' | 'champion-challenger'
  // Input: historical deal IDs or synthetic scenarios used
  testDataset:    jsonb('test_dataset').notNull(),
  // Output: accuracy metrics, calibration stats
  metrics:        jsonb('metrics').notNull(),   // { rmseIrr, maeNpv, calibrationScore, ... }
  passed:         boolean('passed').notNull(),
  // Who validated
  validatedBy:    varchar('validated_by', { length: 255 }).notNull(),
  validatedAt:    timestamp('validated_at').notNull().defaultNow(),
  expiresAt:      timestamp('expires_at'), // validation results expire (re-validation required)
  notes:          varchar('notes', { length: 2000 }),
}, (t) => ({
  engineVersionIdx: index('mvr_engine_version_idx').on(t.engineName, t.modelVersion),
  typeIdx:          index('mvr_type_idx').on(t.validationType),
}));

// ── Risk Register ──
export const risks = pgTable('risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: varchar('description', { length: 2000 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),        // market | construction | financial | regulatory | operational
  likelihood: varchar('likelihood', { length: 20 }).notNull(),     // low | medium | high
  impact: varchar('impact', { length: 20 }).notNull(),             // low | medium | high
  status: varchar('status', { length: 20 }).notNull().default('open'),  // open | mitigated | accepted | closed
  mitigation: varchar('mitigation', { length: 2000 }),
  owner: varchar('owner', { length: 255 }),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dealIdx: index('risks_deal_idx').on(t.dealId),
  statusIdx: index('risks_status_idx').on(t.status),
}));

// ── IAIP: Assumption governance (FEATURE E — AGAT) ──
export const assumptions = pgTable('assumptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  assumptionKey: varchar('assumption_key', { length: 100 }).notNull(),
  value: jsonb('value').notNull(),
  unit: varchar('unit', { length: 20 }),
  owner: varchar('owner', { length: 255 }).notNull(),
  rationale: varchar('rationale', { length: 2000 }),
  source: varchar('source', { length: 255 }),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  lastReviewedAt: timestamp('last_reviewed_at'),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft | reviewed | approved | locked
  approvedBy: varchar('approved_by', { length: 255 }),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  dealStatusIdx: index('assump_deal_status').on(t.dealId, t.status),
  uniqueDealKey: uniqueIndex('assump_deal_key').on(t.dealId, t.assumptionKey),
}));
