// ─── Query Helpers ──────────────────────────────────────────────────
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { deals, engineResults, recommendations, auditLog, users, budgetLines, changeOrders, rfis, milestones, domainEvents, dealAccess, risks, marketDataHistory } from '../schema/index.js';

type DB = PostgresJsDatabase;

// ── Deal ──
export async function getDealById(db: DB, dealId: string) {
  const [deal] = await db.select().from(deals).where(eq(deals.id, dealId)).limit(1);
  return deal ?? null;
}

export async function updateDealAssumptions(
  db: DB, dealId: string,
  patch: { marketAssumptions?: unknown; financialAssumptions?: unknown }
) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.marketAssumptions) updates.marketAssumptions = patch.marketAssumptions;
  if (patch.financialAssumptions) updates.financialAssumptions = patch.financialAssumptions;
  const [updated] = await db.update(deals).set(updates).where(eq(deals.id, dealId)).returning();
  return updated;
}

export async function updateDealActiveScenario(db: DB, dealId: string, scenarioKey: string) {
  const [updated] = await db.update(deals)
    .set({ activeScenarioKey: scenarioKey, updatedAt: new Date() })
    .where(eq(deals.id, dealId))
    .returning();
  return updated;
}

// ── Engine Results (versioned, append-only, hash-chained) ──
// G-2/F-3: Every engine result is cryptographically hash-chained (SHA-256).
// G-10/F-4: Every result is tagged with the model version that produced it.
export async function insertEngineResult(
  db: DB,
  row: {
    dealId: string; engineName: string;
    scenarioKey?: string;
    input: unknown; output: unknown;
    durationMs: number; triggeredBy: string;
    contentHash?: string;       // SHA-256 hash of this result (computed by caller)
    previousHash?: string;      // Hash of the previous result in the chain
    modelVersion?: string;      // Semantic version of the engine model
  }
) {
  // Get next version (scoped by deal + engine + scenario)
  const conditions = [
    eq(engineResults.dealId, row.dealId),
    eq(engineResults.engineName, row.engineName),
  ];
  if (row.scenarioKey) {
    conditions.push(eq(engineResults.scenarioKey, row.scenarioKey));
  }
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${engineResults.version}), 0)` })
    .from(engineResults)
    .where(and(...conditions));

  const [inserted] = await db.insert(engineResults).values({
    dealId: row.dealId,
    engineName: row.engineName,
    scenarioKey: row.scenarioKey,
    input: row.input,
    output: row.output,
    durationMs: row.durationMs,
    triggeredBy: row.triggeredBy,
    contentHash: row.contentHash ?? 'genesis',
    previousHash: row.previousHash ?? 'genesis',
    modelVersion: row.modelVersion ?? '1.0.0',
    version: (max ?? 0) + 1,
  }).returning();
  return inserted;
}

/**
 * Get the most recent content hash for a deal+engine+scenario chain.
 * Used by the recompute service to link the next result in the chain.
 */
export async function getLatestContentHash(
  db: DB,
  dealId: string,
  engineName: string,
  scenarioKey?: string,
): Promise<string> {
  const conditions = [
    eq(engineResults.dealId, dealId),
    eq(engineResults.engineName, engineName),
  ];
  if (scenarioKey) {
    conditions.push(eq(engineResults.scenarioKey, scenarioKey));
  }

  const [row] = await db.select({ contentHash: engineResults.contentHash })
    .from(engineResults)
    .where(and(...conditions))
    .orderBy(desc(engineResults.version))
    .limit(1);

  return row?.contentHash ?? 'genesis';
}

export async function getLatestEngineResult(db: DB, dealId: string, engineName: string) {
  const [row] = await db.select()
    .from(engineResults)
    .where(and(eq(engineResults.dealId, dealId), eq(engineResults.engineName, engineName)))
    .orderBy(desc(engineResults.version))
    .limit(1);
  return row ?? null;
}

// ── Recommendations (versioned, append-only) ──
export async function insertRecommendation(
  db: DB,
  row: {
    dealId: string; scenarioKey?: string;
    verdict: string; confidence: number;
    triggerEvent: string; proformaSnapshot: unknown;
    gateResults: unknown; explanation: string;
    previousVerdict: string | null; isFlip: boolean;
  }
) {
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${recommendations.version}), 0)` })
    .from(recommendations)
    .where(eq(recommendations.dealId, row.dealId));

  const [inserted] = await db.insert(recommendations).values({
    ...row,
    version: (max ?? 0) + 1,
    isFlip: row.isFlip ? 'true' : 'false',
  }).returning();
  return inserted;
}

export async function getLatestRecommendation(db: DB, dealId: string) {
  const [row] = await db.select()
    .from(recommendations)
    .where(eq(recommendations.dealId, dealId))
    .orderBy(desc(recommendations.version))
    .limit(1);
  return row ?? null;
}

// ── Audit Log ──
export async function insertAuditEntry(
  db: DB,
  entry: {
    dealId: string; userId: string; role: string;
    module: string; action: string;
    entityType: string; entityId: string;
    diff: unknown;
  }
) {
  const [inserted] = await db.insert(auditLog).values(entry).returning();
  return inserted;
}

export async function getRecentAudit(db: DB, dealId: string, limit = 20) {
  return db.select()
    .from(auditLog)
    .where(eq(auditLog.dealId, dealId))
    .orderBy(desc(auditLog.timestamp))
    .limit(limit);
}

// ── Users ──
export async function getUserByEmail(db: DB, email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user ?? null;
}

export async function getUserById(db: DB, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function createUser(
  db: DB,
  data: { email: string; name: string; passwordHash: string; role: string }
) {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

// ── Deals (list all) ──
export async function listDeals(db: DB) {
  return db.select({
    id: deals.id,
    name: deals.name,
    assetClass: deals.assetClass,
    status: deals.status,
    lifecyclePhase: deals.lifecyclePhase,
    updatedAt: deals.updatedAt,
  }).from(deals).orderBy(desc(deals.updatedAt));
}

// ── Deal Access ──
export async function listDealsByUser(db: DB, userId: string) {
  // Get all deal IDs this user has access to
  const accessRows = await db.select({ dealId: dealAccess.dealId, role: dealAccess.role })
    .from(dealAccess)
    .where(eq(dealAccess.userId, userId));

  if (accessRows.length === 0) return [];

  const dealIds = accessRows.map(r => r.dealId);
  const roleMap = Object.fromEntries(accessRows.map(r => [r.dealId, r.role]));

  const dealRows = await db.select({
    id: deals.id,
    name: deals.name,
    assetClass: deals.assetClass,
    status: deals.status,
    lifecyclePhase: deals.lifecyclePhase,
    updatedAt: deals.updatedAt,
  }).from(deals)
    .where(inArray(deals.id, dealIds))
    .orderBy(desc(deals.updatedAt));

  return dealRows.map(d => ({ ...d, userRole: roleMap[d.id] ?? 'viewer' }));
}

export async function checkDealAccess(db: DB, userId: string, dealId: string) {
  const [row] = await db.select()
    .from(dealAccess)
    .where(and(eq(dealAccess.userId, userId), eq(dealAccess.dealId, dealId)))
    .limit(1);
  return row ?? null;
}

export async function grantDealAccess(db: DB, data: { userId: string; dealId: string; role: string }) {
  const [inserted] = await db.insert(dealAccess).values(data)
    .onConflictDoUpdate({
      target: [dealAccess.userId, dealAccess.dealId],
      set: { role: data.role },
    })
    .returning();
  return inserted;
}

export async function getDealAccessByDeal(db: DB, dealId: string) {
  return db.select({
    id: dealAccess.id,
    userId: dealAccess.userId,
    role: dealAccess.role,
    userName: users.name,
    userEmail: users.email,
  }).from(dealAccess)
    .innerJoin(users, eq(dealAccess.userId, users.id))
    .where(eq(dealAccess.dealId, dealId));
}

// ── Scenario-aware engine results ──
export async function getLatestEngineResultByScenario(
  db: DB,
  dealId: string,
  engineName: string,
  scenarioKey: 'bear' | 'base' | 'bull'
) {
  const [row] = await db.select()
    .from(engineResults)
    .where(
      and(
        eq(engineResults.dealId, dealId),
        eq(engineResults.engineName, engineName),
        eq(engineResults.scenarioKey, scenarioKey)
      )
    )
    .orderBy(desc(engineResults.version))
    .limit(1);
  return row ?? null;
}

export async function getScenarioResults(
  db: DB,
  dealId: string,
  engineName: string = 'underwriter'
) {
  const bear = await getLatestEngineResultByScenario(db, dealId, engineName, 'bear');
  const base = await getLatestEngineResultByScenario(db, dealId, engineName, 'base');
  const bull = await getLatestEngineResultByScenario(db, dealId, engineName, 'bull');
  return { bear, base, bull };
}

// ── Scenario-aware recommendations ──
export async function getLatestRecommendationByScenario(
  db: DB,
  dealId: string,
  scenarioKey: 'bear' | 'base' | 'bull'
) {
  const [row] = await db.select()
    .from(recommendations)
    .where(
      and(
        eq(recommendations.dealId, dealId),
        eq(recommendations.scenarioKey, scenarioKey)
      )
    )
    .orderBy(desc(recommendations.version))
    .limit(1);
  return row ?? null;
}

export async function getScenarioRecommendations(db: DB, dealId: string) {
  const bear = await getLatestRecommendationByScenario(db, dealId, 'bear');
  const base = await getLatestRecommendationByScenario(db, dealId, 'base');
  const bull = await getLatestRecommendationByScenario(db, dealId, 'bull');
  return { bear, base, bull };
}

// ── Budget Lines ──
export async function getBudgetLinesByDeal(db: DB, dealId: string) {
  return db.select().from(budgetLines).where(eq(budgetLines.dealId, dealId));
}

export async function createBudgetLine(
  db: DB,
  data: {
    dealId: string;
    costCode: string;
    description: string;
    category: string;
    originalAmount: number;
    currentBudget: number;
  }
) {
  const [line] = await db.insert(budgetLines).values({
    ...data,
    originalAmount: String(data.originalAmount),
    currentBudget: String(data.currentBudget),
    approvedCOs: '0',
    actualSpend: '0',
    commitments: '0',
  }).returning();
  return line;
}

export async function updateBudgetLine(
  db: DB,
  budgetLineId: string,
  updates: Record<string, unknown>
) {
  const [updated] = await db.update(budgetLines)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(budgetLines.id, budgetLineId))
    .returning();
  return updated;
}

// ── Change Orders ──
export async function getChangeOrdersByDeal(db: DB, dealId: string) {
  return db.select().from(changeOrders).where(eq(changeOrders.dealId, dealId));
}

export async function createChangeOrder(
  db: DB,
  data: {
    dealId: string;
    budgetLineId: string;
    coNumber: string;
    title: string;
    description: string;
    amount: number;
    requestedBy: string;
  }
) {
  const [co] = await db.insert(changeOrders).values({
    ...data,
    amount: String(data.amount),
    status: 'submitted',
  }).returning();
  return co;
}

export async function approveChangeOrder(
  db: DB,
  coId: string,
  approvedBy: string
) {
  const [co] = await db.update(changeOrders)
    .set({ status: 'approved', approvedBy, updatedAt: new Date() })
    .where(eq(changeOrders.id, coId))
    .returning();
  return co;
}

export async function getChangeOrderById(db: DB, coId: string) {
  const [co] = await db.select().from(changeOrders).where(eq(changeOrders.id, coId)).limit(1);
  return co ?? null;
}

// ── RFIs ──
export async function getRFIsByDeal(db: DB, dealId: string) {
  return db.select().from(rfis).where(eq(rfis.dealId, dealId));
}

export async function createRFI(
  db: DB,
  data: {
    dealId: string;
    rfiNumber: string;
    subject: string;
    question: string;
    raisedBy: string;
  }
) {
  const [rfi] = await db.insert(rfis).values({
    ...data,
    status: 'open',
  }).returning();
  return rfi;
}

export async function answerRFI(
  db: DB,
  rfiId: string,
  answer: string,
  answeredBy: string
) {
  const [rfi] = await db.update(rfis)
    .set({ answer, answeredBy, status: 'answered', updatedAt: new Date() })
    .where(eq(rfis.id, rfiId))
    .returning();
  return rfi;
}

export async function getRFIById(db: DB, rfiId: string) {
  const [rfi] = await db.select().from(rfis).where(eq(rfis.id, rfiId)).limit(1);
  return rfi ?? null;
}

// ── Milestones ──
export async function getMilestonesByDeal(db: DB, dealId: string) {
  return db.select().from(milestones).where(eq(milestones.dealId, dealId));
}

export async function createMilestone(
  db: DB,
  data: {
    dealId: string;
    name: string;
    description: string;
    targetDate: string;
    status?: string;
    percentComplete?: number;
    dependencies?: string[];
  }
) {
  const [ms] = await db.insert(milestones).values({
    ...data,
    status: data.status ?? 'not-started',
    percentComplete: data.percentComplete ?? 0,
    dependencies: data.dependencies ?? [],
  }).returning();
  return ms;
}

export async function updateMilestone(
  db: DB,
  milestoneId: string,
  updates: Record<string, unknown>
) {
  const [updated] = await db.update(milestones)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(milestones.id, milestoneId))
    .returning();
  return updated;
}

export async function getMilestoneById(db: DB, milestoneId: string) {
  const [ms] = await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  return ms ?? null;
}

// ── Construction Dashboard Summary ──
export async function getConstructionSummary(db: DB, dealId: string) {
  const lines = await getBudgetLinesByDeal(db, dealId);
  
  const totalBudget = lines.reduce((sum, line) => sum + parseFloat(line.currentBudget as string), 0);
  const totalApprovedCOs = lines.reduce((sum, line) => sum + parseFloat(line.approvedCOs as string), 0);
  const totalActualSpend = lines.reduce((sum, line) => sum + parseFloat(line.actualSpend as string), 0);
  const totalCommitments = lines.reduce((sum, line) => sum + parseFloat(line.commitments as string), 0);
  const budgetVariance = totalBudget - totalActualSpend - totalCommitments;
  
  const allMilestones = await getMilestonesByDeal(db, dealId);
  const completionPct = allMilestones.length > 0
    ? Math.round(allMilestones.reduce((sum, m) => sum + m.percentComplete, 0) / allMilestones.length)
    : 0;

  return {
    totalBudget,
    totalApprovedCOs,
    totalActualSpend,
    totalCommitments,
    budgetVariance,
    completionPct,
  };
}

// ── Domain Events ──
export async function insertDomainEvent(
  db: DB,
  event: {
    dealId: string;
    type: string;
    payload: unknown;
    idempotencyKey?: string;
  }
) {
  // Get next sequence number for this deal
  const [{ max }] = await db
    .select({ max: sql<number>`COALESCE(MAX(${domainEvents.seqNo}), 0)` })
    .from(domainEvents)
    .where(eq(domainEvents.dealId, event.dealId));

  const [inserted] = await db.insert(domainEvents).values({
    dealId: event.dealId,
    type: event.type,
    payload: event.payload,
    seqNo: (max ?? 0) + 1,
    idempotencyKey: event.idempotencyKey ?? null,
    status: 'PENDING',
    retryCount: 0,
  }).returning();
  return inserted;
}

export async function getPendingEvents(db: DB, limit = 50) {
  return db.select()
    .from(domainEvents)
    .where(eq(domainEvents.status, 'PENDING'))
    .orderBy(domainEvents.createdAt)
    .limit(limit);
}

export async function markEventProcessed(db: DB, eventId: string) {
  const [updated] = await db.update(domainEvents)
    .set({ status: 'PROCESSED', processedAt: new Date() })
    .where(eq(domainEvents.id, eventId))
    .returning();
  return updated;
}

export async function markEventFailed(db: DB, eventId: string) {
  // Increment retry count; move to DEAD_LETTER after 3 retries
  const existing = await db.select().from(domainEvents).where(eq(domainEvents.id, eventId)).limit(1);
  if (!existing.length) return null;
  const retryCount = existing[0].retryCount + 1;
  const newStatus = retryCount >= 3 ? 'DEAD_LETTER' : 'FAILED';
  const [updated] = await db.update(domainEvents)
    .set({ status: newStatus, retryCount })
    .where(eq(domainEvents.id, eventId))
    .returning();
  return updated;
}

export async function getDeadLetterEvents(db: DB, dealId?: string) {
  const conditions = dealId
    ? and(eq(domainEvents.status, 'DEAD_LETTER'), eq(domainEvents.dealId, dealId))
    : eq(domainEvents.status, 'DEAD_LETTER');
  return db.select().from(domainEvents).where(conditions).orderBy(domainEvents.createdAt);
}

// ── Risks ──
export async function getRisksByDeal(db: DB, dealId: string) {
  return db.select().from(risks).where(eq(risks.dealId, dealId)).orderBy(desc(risks.createdAt));
}

export async function getRiskById(db: DB, riskId: string) {
  const [row] = await db.select().from(risks).where(eq(risks.id, riskId)).limit(1);
  return row ?? null;
}

export async function createRisk(
  db: DB,
  data: {
    dealId: string;
    title: string;
    description: string;
    category: string;
    likelihood: string;
    impact: string;
    mitigation?: string;
    owner?: string;
    createdBy: string;
  }
) {
  const [row] = await db.insert(risks).values({
    ...data,
    status: 'open',
  }).returning();
  return row;
}

export async function updateRisk(
  db: DB,
  riskId: string,
  updates: Record<string, unknown>
) {
  const [updated] = await db.update(risks)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(risks.id, riskId))
    .returning();
  return updated;
}

export async function getRiskSummary(db: DB, dealId: string) {
  const allRisks = await getRisksByDeal(db, dealId);
  const open = allRisks.filter(r => r.status === 'open');
  const highOpen = open.filter(r => r.impact === 'high' || r.likelihood === 'high');
  return {
    total: allRisks.length,
    open: open.length,
    highPriority: highOpen.length,
    categories: [...new Set(allRisks.map(r => r.category))],
  };
}

// ── Deal Creation ──
export async function createDeal(
  db: DB,
  data: {
    name: string;
    assetClass: string;
    property: unknown;
    partnership: unknown;
    marketAssumptions: unknown;
    financialAssumptions: unknown;
    capexPlan: unknown;
    opexModel: unknown;
    scenarios: unknown;
  }
) {
  const [deal] = await db.insert(deals).values({
    ...data,
    status: 'draft',
    lifecyclePhase: 'pre-development',
    currentMonth: 0,
    version: 1,
    activeScenarioKey: 'base',
  }).returning();
  return deal;
}

// ── Deal Month Update ──
export async function updateDealCurrentMonth(
  db: DB,
  dealId: string,
  newMonth: number
) {
  const [updated] = await db.update(deals)
    .set({ currentMonth: newMonth, updatedAt: new Date() })
    .where(eq(deals.id, dealId))
    .returning();
  return updated;
}

// ── Recommendation History ──
export async function getRecommendationHistory(db: DB, dealId: string, limit = 50) {
  return db.select()
    .from(recommendations)
    .where(eq(recommendations.dealId, dealId))
    .orderBy(desc(recommendations.version))
    .limit(limit);
}

// ── Engine Result History ──
export async function getEngineResultHistory(
  db: DB,
  dealId: string,
  engineName: string,
  scenarioKey?: string,
  limit = 50
) {
  const conditions = [
    eq(engineResults.dealId, dealId),
    eq(engineResults.engineName, engineName),
  ];
  if (scenarioKey) {
    conditions.push(eq(engineResults.scenarioKey, scenarioKey));
  }

  return db.select()
    .from(engineResults)
    .where(and(...conditions))
    .orderBy(desc(engineResults.version))
    .limit(limit);
}

// ── Market Data History (G-4/F-8: append-only audit trail) ──
export async function insertMarketDataHistory(
  db: DB,
  entries: Array<{
    indicator: string;
    value: number;
    asOfDate: string;
    source: string;
    sourceType: string;
    previousValue?: number;
    changeReason?: string;
  }>,
) {
  if (entries.length === 0) return;
  const rows = entries.map(e => ({
    indicator: e.indicator,
    value: String(e.value),
    asOfDate: e.asOfDate,
    source: e.source,
    sourceType: e.sourceType,
    previousValue: e.previousValue != null ? String(e.previousValue) : null,
    changeReason: e.changeReason ?? null,
  }));
  await db.insert(marketDataHistory).values(rows);
}
