// ─── Zod Validation Schemas for Assumptions ────────────────────────
import { z } from 'zod';

// ── Market Assumptions ──
export const MarketAssumptionsSchema = z.object({
  occupancyRamp: z.array(z.number().min(0).max(1)).min(1).max(15),
  adrBase: z.number().positive().describe('Base ADR in INR'),
  adrStabilized: z.number().positive().describe('Stabilized ADR in INR'),
  adrGrowthRate: z.number().min(-0.1).max(0.2).describe('Annual ADR growth rate'),
  revenueMix: z.object({
    rooms: z.number().min(0.1).max(1),
    fb: z.number().min(0).max(1),
    banquet: z.number().min(0).max(1),
    other: z.number().min(0).max(1),
  }).refine(
    (mix) => Math.abs(mix.rooms + mix.fb + mix.banquet + mix.other - 1) < 0.01,
    { message: 'Revenue mix must sum to 1.0' }
  ),
});

// ── Financial Assumptions ──
export const FinancialAssumptionsSchemaBase = z.object({
  wacc: z.number().min(0.01).max(0.30).describe('Weighted average cost of capital'),
  riskFreeRate: z.number().min(0).max(0.20),
  equityRatio: z.number().min(0).max(1),
  debtRatio: z.number().min(0).max(1),
  debtInterestRate: z.number().min(0).max(0.30),
  debtTenorYears: z.number().int().min(1).max(30),
  exitMultiple: z.number().min(1).max(30),
  taxRate: z.number().min(0).max(0.50),
  inflationRate: z.number().min(0).max(0.20),
  managementFeePct: z.number().min(0).max(0.10),
  incentiveFeePct: z.number().min(0).max(0.20),
  ffAndEReservePct: z.number().min(0).max(0.10),
  targetIRR: z.number().min(0.01).max(0.50),
});

export const FinancialAssumptionsSchema = FinancialAssumptionsSchemaBase.refine(
  (fin) => Math.abs(fin.equityRatio + fin.debtRatio - 1) < 0.01,
  { message: 'Equity + Debt ratios must sum to 1.0' }
);

// ── Property ──
export const PropertySchema = z.object({
  location: z.object({
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(1),
    distanceToAirportKm: z.number().min(0),
  }),
  keys: z.object({
    phase1: z.number().int().positive(),
    phase2: z.number().int().min(0),
    total: z.number().int().positive(),
  }),
  starRating: z.union([z.literal(3), z.literal(4), z.literal(5)]),
});

// ── Partnership ──
export const PartnerSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  equityPct: z.number().min(0).max(1),
  role: z.enum(['lead-investor', 'co-investor', 'operator', 'lender']),
  commitmentCr: z.number().min(0),
});

export const PartnershipSchema = z.object({
  structure: z.enum(['jv', 'sole', 'syndication']),
  partners: z.array(PartnerSchema).min(1),
}).refine(
  (p) => Math.abs(p.partners.reduce((sum, pt) => sum + pt.equityPct, 0) - 1) < 0.01,
  { message: 'Partner equity percentages must sum to 1.0' }
);

// ── CAPEX ──
export const CapexLineItemSchema = z.object({
  id: z.string(),
  costCode: z.string().min(1),
  description: z.string(),
  category: z.string().min(1),
  budgetAmount: z.number().min(0),
});

export const CapexPlanSchema = z.object({
  phase1: z.object({
    totalBudgetCr: z.number().positive(),
    items: z.array(CapexLineItemSchema),
  }),
  phase2: z.object({
    totalBudgetCr: z.number().min(0),
    items: z.array(CapexLineItemSchema),
  }),
  contingencyPct: z.number().min(0).max(0.30),
});

// ── OpEx (USALI Departments) ──
export const USALIDepartmentSchema = z.object({
  name: z.string().min(1),
  costPctOfRevenue: z.number().min(0).max(0.50),
  fixedFloorMonthly: z.number().min(0),
});

export const OpexModelSchemaBase = z.object({
  departments: z.array(USALIDepartmentSchema).min(1),
});

export const OpexModelSchema = OpexModelSchemaBase.refine(
  (opex) => opex.departments.reduce((sum, d) => sum + d.costPctOfRevenue, 0) < 0.85,
  { message: 'Total departmental cost % of revenue must be < 85%' }
);

// ── Scenario ──
export const ScenarioSchema = z.object({
  id: z.string(),
  name: z.enum(['bear', 'base', 'bull']),
  probability: z.number().min(0).max(1),
  occupancyStabilized: z.number().min(0).max(1),
  adrStabilized: z.number().positive(),
  ebitdaMargin: z.number().min(0).max(1),
  phase2Trigger: z.boolean(),
});

export const ScenarioSetSchema = z.object({
  bear: ScenarioSchema,
  base: ScenarioSchema,
  bull: ScenarioSchema,
});

// ── Macro Indicators ──
export const MacroIndicatorsSchema = z.object({
  repoRate: z.number().min(0).max(0.25),
  cpi: z.number().min(-0.05).max(0.30),
  gdpGrowthRate: z.number().min(-0.10).max(0.20),
  bondYield10Y: z.number().min(0).max(0.25),
  hotelSupplyGrowthPct: z.number().min(-0.20).max(0.50),
});

// ── Partial update schemas for PATCH endpoints ──
export const AssumptionPatchSchema = z.object({
  marketAssumptions: MarketAssumptionsSchema.partial().optional(),
  financialAssumptions: FinancialAssumptionsSchemaBase.partial().optional(),
  opexModel: OpexModelSchemaBase.partial().optional(),
  scenarios: z.object({
    bear: ScenarioSchema.partial().optional(),
    base: ScenarioSchema.partial().optional(),
    bull: ScenarioSchema.partial().optional(),
  }).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one assumption field must be provided' }
);
