// Seed runner: creates database (if needed), tables, and inserts demo users + V3 Grand deal + construction data
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { deals, engineResults, recommendations, auditLog, users, budgetLines, changeOrders, rfis, milestones, dealAccess, risks } from '../schema/index.js';
import { v3GrandSeed, V3_GRAND_DEAL_ID } from './v3grand.js';
import { execSync } from 'child_process';
import { scryptSync, randomBytes } from 'crypto';

// On macOS, Homebrew Postgres uses your OS username with no password.
// Detect the current user as fallback if DATABASE_URL isn't set.
const osUser = process.env.USER ?? process.env.USERNAME ?? 'postgres';
const DEFAULT_URL = `postgres://${osUser}@localhost:5432/v3grand`;
const DATABASE_URL = process.env.DATABASE_URL ?? DEFAULT_URL;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function ensureDatabase() {
  // Parse the target database name from DATABASE_URL
  const url = new URL(DATABASE_URL.replace(/^postgres:\/\//, 'http://'));
  const dbName = url.pathname.slice(1); // 'v3grand'
  const user = url.username || osUser;
  const password = url.password || undefined;
  const host = url.hostname || 'localhost';
  const port = url.port || '5432';

  // Connect to the default 'postgres' or 'template1' maintenance DB
  const maintUrl = password
    ? `postgres://${user}:${password}@${host}:${port}/template1`
    : `postgres://${user}@${host}:${port}/template1`;

  const maint = postgres(maintUrl, { max: 1 });
  try {
    const exists = await maint`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) {
      console.log(`Creating database "${dbName}"...`);
      await maint.unsafe(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } finally {
    await maint.end();
  }
}

async function seed() {
  await ensureDatabase();

  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  console.log('Creating tables...');
  
  // Users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'viewer',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // Deals table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deals (
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
    )
  `);

  // Deal Access table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS deal_access (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      deal_id UUID NOT NULL REFERENCES deals(id),
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, deal_id)
    );
    CREATE INDEX IF NOT EXISTS da_deal_idx ON deal_access(deal_id);
    CREATE INDEX IF NOT EXISTS da_user_idx ON deal_access(user_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS engine_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS er_deal_engine_scenario_latest ON engine_results(deal_id, engine_name, scenario_key, created_at);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recommendations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS rec_deal_scenario_latest ON recommendations(deal_id, scenario_key, created_at);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      deal_id UUID NOT NULL REFERENCES deals(id),
      user_id VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      module VARCHAR(50) NOT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(255),
      diff JSONB
    );
    CREATE INDEX IF NOT EXISTS audit_deal_time ON audit_log(deal_id, timestamp);
  `);

  // Construction tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS budget_lines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS budget_lines_deal_idx ON budget_lines(deal_id);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS change_orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
      budget_line_id UUID NOT NULL REFERENCES budget_lines(id),
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
    CREATE INDEX IF NOT EXISTS change_orders_deal_idx ON change_orders(deal_id);
    CREATE INDEX IF NOT EXISTS change_orders_status_idx ON change_orders(status);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS rfis (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS rfis_deal_idx ON rfis(deal_id);
    CREATE INDEX IF NOT EXISTS rfis_status_idx ON rfis(status);
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS milestones (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS milestones_deal_idx ON milestones(deal_id);
    CREATE INDEX IF NOT EXISTS milestones_status_idx ON milestones(status);
  `);

  console.log('Creating demo users...');
  
  const demoUsers = [
    { email: 'lead@v3grand.com', name: 'Alice Lead', role: 'lead-investor' },
    { email: 'co@v3grand.com', name: 'Bob Co', role: 'co-investor' },
    { email: 'ops@v3grand.com', name: 'Charlie Ops', role: 'operator' },
    { email: 'viewer@v3grand.com', name: 'Diana Viewer', role: 'viewer' },
    { email: 'lp1@v3grand.com', name: 'Ethan LP', role: 'co-investor' },
    { email: 'lp2@v3grand.com', name: 'Fiona LP', role: 'viewer' },
  ];

  for (const user of demoUsers) {
    const existing = await db.select().from(users).where(sql`email = ${user.email}`).limit(1);
    if (existing.length === 0) {
      const passwordHash = hashPassword('demo123');
      await db.insert(users).values({
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
      });
      console.log(`  Created user: ${user.email} (${user.role})`);
    }
  }

  console.log('Seeding V3 Grand deal...');
  const existing = await db.select().from(deals).where(sql`id = ${V3_GRAND_DEAL_ID}`).limit(1);
  if (existing.length === 0) {
    await db.insert(deals).values({
      ...v3GrandSeed,
      createdAt: new Date(v3GrandSeed.createdAt),
      updatedAt: new Date(v3GrandSeed.updatedAt),
    });
  }

  console.log(`Seeded deal: ${v3GrandSeed.name} (${V3_GRAND_DEAL_ID})`);

  // Grant all demo users access to the V3 Grand deal
  console.log('Granting deal access...');
  const allUsers = await db.select().from(users);
  for (const u of allUsers) {
    const existingAccess = await db.select().from(dealAccess)
      .where(sql`user_id = ${u.id} AND deal_id = ${V3_GRAND_DEAL_ID}`)
      .limit(1);
    if (existingAccess.length === 0) {
      await db.insert(dealAccess).values({
        userId: u.id,
        dealId: V3_GRAND_DEAL_ID,
        role: u.role,
      });
      console.log(`  Granted ${u.role} access to ${u.email}`);
    }
  }

  // Run initial underwrite for all scenarios
  const { buildProForma } = await import('../../../engines/src/underwriter/index.js');
  const { evaluate: evaluateDecision } = await import('../../../engines/src/decision/index.js');
  const { insertEngineResult, insertRecommendation } = await import('../queries/index.js');

  const deal = v3GrandSeed;
  const scenarios: Array<'bear' | 'base' | 'bull'> = ['bear', 'base', 'bull'];

  for (const scenarioKey of scenarios) {
    const proforma = buildProForma({ deal, scenarioKey });

    const existingResult = await db.select().from(engineResults)
      .where(sql`deal_id = ${V3_GRAND_DEAL_ID} AND engine_name = 'underwriter' AND scenario_key = ${scenarioKey}`)
      .limit(1);
    
    if (existingResult.length === 0) {
      await insertEngineResult(db, {
        dealId: V3_GRAND_DEAL_ID,
        engineName: 'underwriter',
        scenarioKey,
        input: { scenarioKey },
        output: proforma as unknown as Record<string, unknown>,
        durationMs: 1,
        triggeredBy: 'seed',
      });

      const decision = evaluateDecision({
        deal,
        proformaResult: proforma,
        currentRecommendation: null,
      });

      await insertRecommendation(db, {
        dealId: V3_GRAND_DEAL_ID,
        scenarioKey,
        verdict: decision.verdict,
        confidence: decision.confidence,
        triggerEvent: 'seed',
        proformaSnapshot: {
          irr: proforma.irr,
          npv: proforma.npv,
          equityMultiple: proforma.equityMultiple,
          avgDSCR: proforma.avgDSCR,
        },
        gateResults: decision.gateResults,
        explanation: decision.explanation,
        previousVerdict: null,
        isFlip: false,
      });

      console.log(`  ${scenarioKey.toUpperCase()}: IRR=${(proforma.irr * 100).toFixed(1)}%, Verdict=${decision.verdict}`);
    }
  }

  // Seed construction data for the deal
  console.log('Seeding construction data...');
  
  const budgetLinesData = [
    { costCode: '01.01', description: 'Site Acquisition', category: 'Land', originalAmount: 5000000, currentBudget: 5000000 },
    { costCode: '02.01', description: 'Foundation & Structure', category: 'Hard Costs', originalAmount: 25000000, currentBudget: 25000000 },
    { costCode: '02.02', description: 'MEP', category: 'Hard Costs', originalAmount: 12000000, currentBudget: 12000000 },
    { costCode: '03.01', description: 'Finishes', category: 'Hard Costs', originalAmount: 18000000, currentBudget: 18000000 },
    { costCode: '04.01', description: 'Soft Costs', category: 'Soft Costs', originalAmount: 8000000, currentBudget: 8000000 },
  ];

  const budgetLineIds: Record<string, string> = {};
  for (const line of budgetLinesData) {
    const existing = await db.select().from(budgetLines)
      .where(sql`deal_id = ${V3_GRAND_DEAL_ID} AND cost_code = ${line.costCode}`)
      .limit(1);
    
    if (existing.length === 0) {
      const inserted = await db.insert(budgetLines).values({
        dealId: V3_GRAND_DEAL_ID,
        costCode: line.costCode,
        description: line.description,
        category: line.category,
        originalAmount: String(line.originalAmount),
        currentBudget: String(line.currentBudget),
      }).returning();
      budgetLineIds[line.costCode] = inserted[0].id;
    } else {
      budgetLineIds[line.costCode] = existing[0].id;
    }
  }

  // Add a sample milestone
  const existingMs = await db.select().from(milestones)
    .where(sql`deal_id = ${V3_GRAND_DEAL_ID}`)
    .limit(1);
  
  if (existingMs.length === 0) {
    await db.insert(milestones).values({
      dealId: V3_GRAND_DEAL_ID,
      name: 'Construction Phase 1',
      description: 'Foundation and structural work',
      targetDate: '2025-06-30',
      status: 'in-progress',
      percentComplete: 45,
      dependencies: [],
    });
  }

  // ── Domain Events table ──
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS domain_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS de_status_idx ON domain_events(status);
  `);

  // ── Risks table ──
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS risks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
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
    CREATE INDEX IF NOT EXISTS risks_deal_idx ON risks(deal_id);
    CREATE INDEX IF NOT EXISTS risks_status_idx ON risks(status);
  `);

  // Seed sample risks
  console.log('Seeding risk register...');
  const existingRisks = await db.select().from(risks)
    .where(sql`deal_id = ${V3_GRAND_DEAL_ID}`)
    .limit(1);

  if (existingRisks.length === 0) {
    const sampleRisks = [
      {
        dealId: V3_GRAND_DEAL_ID,
        title: 'Construction cost overrun',
        description: 'Hard costs may exceed budget due to supply chain volatility and labor shortages in the Madurai market.',
        category: 'construction',
        likelihood: 'medium',
        impact: 'high',
        status: 'open',
        mitigation: 'Fixed-price contracts for 70% of hard costs; 10% contingency buffer in capex plan.',
        owner: 'ops@v3grand.com',
        createdBy: 'lead@v3grand.com',
      },
      {
        dealId: V3_GRAND_DEAL_ID,
        title: 'ADR growth falls short of projections',
        description: 'New competing hotel supply in the Madurai micro-market could depress average daily rates below base case.',
        category: 'market',
        likelihood: 'medium',
        impact: 'medium',
        status: 'open',
        mitigation: 'Bear scenario models 15% ADR haircut; brand affiliation provides rate floor.',
        owner: 'lead@v3grand.com',
        createdBy: 'lead@v3grand.com',
      },
      {
        dealId: V3_GRAND_DEAL_ID,
        title: 'Interest rate increase on floating debt',
        description: 'RBI rate hikes could increase debt service costs if floating-rate tranche reprices higher.',
        category: 'financial',
        likelihood: 'low',
        impact: 'medium',
        status: 'mitigated',
        mitigation: 'Cap agreement in place for 60% of floating exposure at +150bps.',
        owner: 'co@v3grand.com',
        createdBy: 'lead@v3grand.com',
      },
      {
        dealId: V3_GRAND_DEAL_ID,
        title: 'Environmental clearance delay',
        description: 'Phase 2 expansion may face delays in state-level environmental approval, extending timeline by 3-6 months.',
        category: 'regulatory',
        likelihood: 'low',
        impact: 'low',
        status: 'accepted',
        mitigation: null,
        owner: 'ops@v3grand.com',
        createdBy: 'ops@v3grand.com',
      },
    ];

    for (const risk of sampleRisks) {
      await db.insert(risks).values(risk);
    }
    console.log(`  Seeded ${sampleRisks.length} sample risks`);
  }

  console.log('Seed complete.');
  await client.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
