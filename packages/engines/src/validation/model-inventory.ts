// ─── Model Inventory Register (SR 11-7 / SS1/23 Compliance) ────────
// G-8/F-12: Formal model card documenting each engine.
//
// Each model card contains: name, owner, materiality tier, methodology,
// known limitations, approved use cases, prohibited uses, validation status.

export interface ModelCard {
  id: string;
  name: string;
  version: string;
  description: string;
  owner: string;
  materialityTier: 'HIGH' | 'MEDIUM' | 'LOW';
  methodology: string;
  assumptions: string[];
  knownLimitations: string[];
  approvedUseCases: string[];
  prohibitedUses: string[];
  inputSchema: string;
  outputSchema: string;
  validationStatus: 'VALIDATED' | 'PENDING_VALIDATION' | 'EXPIRED' | 'NOT_VALIDATED';
  lastValidatedAt?: string;
  nextValidationDue?: string;
  changeLog: Array<{ version: string; date: string; description: string }>;
}

/**
 * Complete model inventory for V3 Grand Investment OS.
 */
export const MODEL_INVENTORY: ModelCard[] = [
  {
    id: 'factor',
    name: 'Factor Scoring Engine',
    version: '1.2.0',
    description: 'Multi-domain weighted scoring model that evaluates investment attractiveness across 4 domains: Global macro (25%), Local market (25%), Asset quality (30%), and Sponsor strength (20%). Produces a composite score (0-5) and implied discount rate.',
    owner: 'Quantitative Strategy Team',
    materialityTier: 'HIGH',
    methodology: 'Weighted linear combination of scored indicators across 4 domains. Each indicator is scored 1-5 using predefined thresholds calibrated to Indian hotel investment benchmarks. Domain weights reflect institutional investor preferences. Implied discount rate = risk-free + (5 - composite) × 3%.',
    assumptions: [
      'Domain weights are static and may not reflect changing market conditions',
      'Indicator thresholds are calibrated for Indian hospitality (2024-2026 macro cycle)',
      'Local scoring includes city-specific adjustments for tourism/temple/medical demand',
      'Risk-free rate proxy is the RBI repo rate or 10Y G-Sec yield',
    ],
    knownLimitations: [
      'Hotel-specific domain scoring — requires new AssetClassProfile for other asset classes (see asset-profiles.ts)',
      'Madurai local scoring includes temple/medical tourism bonus not applicable to all cities',
      'No dynamic weight adjustment based on market regime',
      'GDP and CPI thresholds may need recalibration if India enters sustained deflation or >10% inflation',
      'Sponsor scoring is simplistic (equity %, partner count, target IRR) — does not assess track record',
    ],
    approvedUseCases: [
      'Pre-screening hotel investment opportunities in Indian Tier 1-3 cities',
      'Generating implied discount rates for DCF analysis',
      'Macro environment assessment for investment committee memos',
    ],
    prohibitedUses: [
      'Direct use as sole investment decision criterion',
      'Application to non-Indian geographies without recalibration',
      'Application to non-hospitality assets without proper AssetClassProfile',
    ],
    inputSchema: '{ deal: Deal, macroIndicators?: MacroIndicators }',
    outputSchema: '{ compositeScore: number, domainScores: {...}, impliedDiscountRate: number }',
    validationStatus: 'PENDING_VALIDATION',
    changeLog: [
      { version: '1.0.0', date: '2025-08-15', description: 'Initial 4-domain scoring with hotel focus' },
      { version: '1.1.0', date: '2025-11-20', description: 'Added Madurai-specific local scoring (temple/medical tourism)' },
      { version: '1.2.0', date: '2026-03-04', description: 'Updated macro thresholds for 2026 cycle; added asset-class abstraction via AssetClassProfile' },
    ],
  },
  {
    id: 'underwriter',
    name: 'Hotel Pro Forma Underwriter',
    version: '1.1.0',
    description: '10-year hotel cash flow projection engine. Builds year-by-year P&L with occupancy ramp, ADR escalation, revenue mix decomposition (rooms/F&B/banquet/other), USALI-aligned departmental expenses, debt service (level annuity), and terminal value. Computes IRR, NPV, equity multiple, DSCR, and payback year.',
    owner: 'Underwriting & Valuation Team',
    materialityTier: 'HIGH',
    methodology: 'Deterministic 10-year pro forma using: (1) Occupancy ramp to stabilization by year 5, with Phase 2 keys trigger at year 4; (2) ADR linear ramp then inflation-adjusted; (3) Revenue = Keys × 365 × Occupancy × ADR × Revenue Mix; (4) EBITDA margin from scenario; (5) Debt service via level annuity formula; (6) FCFE = EBITDA - tax - debt service; (7) Exit value = Year 10 EBITDA × exit multiple; (8) IRR/NPV via Newton-Raphson iteration.',
    assumptions: [
      'Occupancy stabilizes by year 5 in base case',
      'ADR grows at inflation rate post-stabilization',
      'Revenue mix ratios are constant across projection period',
      'Tax rate is flat 25% with no incentives or credits',
      'Debt is structured as a single tranche level annuity',
      'Exit occurs at end of year 10 via terminal value method',
    ],
    knownLimitations: [
      'Single-tranche debt — does not model mezzanine/bridge financing',
      'No seasonality adjustment within annual figures',
      'Working capital is simplified (days-based, not cash flow cycle)',
      'FF&E reserve is a fixed percentage, not age-adjusted',
      'No inflation differential between revenue and cost lines',
    ],
    approvedUseCases: [
      'Initial deal screening and go/no-go assessment',
      'Scenario analysis (bear/base/bull) for investment committee',
      'Sensitivity analysis input for Monte Carlo engine',
    ],
    prohibitedUses: [
      'Final NAV computation for fund reporting (requires third-party valuation)',
      'Regulatory capital adequacy computation',
      'Lending decisions without independent bank underwriting',
    ],
    inputSchema: '{ deal: Deal, scenarioKey: "bear" | "base" | "bull" }',
    outputSchema: '{ years: ProFormaYear[], irr: number, npv: number, equityMultiple: number, avgDSCR: number, paybackYear: number, exitValue: number }',
    validationStatus: 'PENDING_VALIDATION',
    changeLog: [
      { version: '1.0.0', date: '2025-08-15', description: 'Initial 10-year pro forma with Phase 2 trigger' },
      { version: '1.1.0', date: '2025-12-10', description: 'Added revenue mix decomposition and USALI alignment' },
    ],
  },
  {
    id: 'montecarlo',
    name: 'Monte Carlo Simulation Engine',
    version: '1.0.0',
    description: '5,000-iteration stochastic simulation that perturbs key deal assumptions (occupancy, ADR, exit multiple, EBITDA margin) using triangular and lognormal distributions. Produces IRR/NPV probability distributions, P(NPV<0), and Pearson correlation sensitivity analysis.',
    owner: 'Quantitative Strategy Team',
    materialityTier: 'HIGH',
    methodology: 'For each iteration: (1) Perturb occupancy (triangular 0.55-0.90), ADR (lognormal σ=0.10), exit multiple (triangular ±30%), EBITDA margin (triangular); (2) Run underwriter with perturbed assumptions; (3) Collect IRR and NPV; (4) Compute percentiles (P10/P25/P50/P75/P90), histogram (50 bins), P(NPV<0); (5) Pearson correlation of each input vs. NPV for sensitivity ranking.',
    assumptions: [
      'Input distributions are independent (no correlation between occupancy and ADR)',
      'Distribution shapes are fixed (triangular for bounded, lognormal for positive-skewed)',
      'Base case parameters define the mode of each distribution',
      '5,000 iterations provide adequate convergence for key percentiles',
      'Seeded RNG ensures reproducibility when seed is provided',
    ],
    knownLimitations: [
      'No input correlation (occupancy and ADR are correlated in reality)',
      'Fixed distribution shapes — may not match empirical hotel performance data',
      'Does not model path-dependent risks (e.g., bankruptcy triggers)',
      'Phase 2 trigger logic is simplified (occupancy threshold only)',
      'No time-varying perturbations (same shock applied to all years)',
    ],
    approvedUseCases: [
      'Risk assessment and probability-weighted returns analysis',
      'Investment committee stress reporting',
      'Decision gate input (P(NPV<0), MC P10 IRR)',
    ],
    prohibitedUses: [
      'VaR computation without proper tail risk modeling',
      'Regulatory stress testing (requires prescribed scenarios, not stochastic)',
    ],
    inputSchema: '{ deal: Deal, iterations: number, seed?: number }',
    outputSchema: '{ irrDistribution: Percentiles, npvDistribution: Percentiles, probNpvNegative: number, sensitivity: {name,correlation}[], histogram: Bin[] }',
    validationStatus: 'PENDING_VALIDATION',
    changeLog: [
      { version: '1.0.0', date: '2025-09-01', description: 'Initial implementation with triangular + lognormal perturbations' },
    ],
  },
  {
    id: 'budget',
    name: 'Budget Variance Analysis Engine',
    version: '1.0.0',
    description: 'Construction cost tracking and variance analysis. Aggregates budget lines, computes per-line and portfolio-level variances, generates RAG (Red/Amber/Green) alerts for cost overruns, pending change orders, open RFIs, and delayed milestones.',
    owner: 'Construction Management Team',
    materialityTier: 'MEDIUM',
    methodology: 'Per-line: Forecast = max(actual spend, commitments); Variance = forecast - current budget; RAG: >20% = RED, >10% = AMBER, else GREEN. Portfolio: aggregate all lines, alert if total forecast > 105% of budget. Additional alerts for pending COs, open RFIs (>3), and milestones past target date.',
    assumptions: [
      'Forecast is conservative (max of actuals and commitments)',
      'Change orders in draft/submitted status are "pending" (not yet approved)',
      'RFI count >3 indicates design coordination issues',
      'Milestone delays are flagged regardless of criticality path',
    ],
    knownLimitations: [
      'No earned value analysis (CPI, SPI)',
      'No S-curve variance tracking (planned vs. actual cash flow)',
      'Forecast method is simplistic — does not estimate remaining work',
      'No inflation adjustment on future commitments',
    ],
    approvedUseCases: [
      'Monthly construction progress reporting',
      'Cost overrun early warning',
      'Decision gate input (budget variance < 10% threshold)',
    ],
    prohibitedUses: [
      'Certified cost reporting for lender draw requests',
      'Insurance claim substantiation',
    ],
    inputSchema: '{ deal, budgetLines, changeOrders, rfis, milestones, asOfMonth }',
    outputSchema: '{ overallStatus, totalBudget, totalForecast, varianceToCurrent, lineVariances[], alerts[] }',
    validationStatus: 'PENDING_VALIDATION',
    changeLog: [
      { version: '1.0.0', date: '2025-10-15', description: 'Initial budget variance with RAG alerting' },
    ],
  },
  {
    id: 'scurve',
    name: 'S-Curve CAPEX Distribution Engine',
    version: '1.0.0',
    description: 'Distributes CAPEX line items across construction months using logistic (S-curve), linear, front-loaded (Beta 2,5), or back-loaded (Beta 5,2) distribution shapes. Produces monthly and cumulative cash flow arrays.',
    owner: 'Construction Management Team',
    materialityTier: 'LOW',
    methodology: 'For each CAPEX item: generate raw weights using selected curve shape (logistic derivative for S-curve, Beta PDF for front/back-loaded); normalize weights to sum to 1; distribute item amount proportionally across months. Aggregate all items into monthly and cumulative arrays.',
    assumptions: [
      'All items within a single phase (24-month default)',
      'Curve shape is selected per item but typically uniform S-curve',
      'No financing cost overlay on cash flows',
    ],
    knownLimitations: [
      'Fixed 24-month construction period — not configurable per deal',
      'No working capital or financing cost layer',
      'No integration with actual milestone-based progress',
    ],
    approvedUseCases: [
      'CAPEX cash flow planning and draw scheduling',
      'Construction phase budget visualization',
    ],
    prohibitedUses: [],
    inputSchema: '{ items: {id, costCode, amount, startMonth, endMonth, curveType}[], totalMonths }',
    outputSchema: '{ monthlyCashflows: number[], cumulativeCashflows: number[], totalAmount: number }',
    validationStatus: 'PENDING_VALIDATION',
    changeLog: [
      { version: '1.0.0', date: '2025-10-15', description: 'Initial with logistic, linear, and Beta curves' },
    ],
  },
  {
    id: 'decision',
    name: 'Investment Decision Engine',
    version: '1.3.0',
    description: '10-gate investment committee framework. Evaluates deal against institutional investment criteria, produces pass-rate-based verdict (INVEST/HOLD/DE-RISK/EXIT/DO-NOT-PROCEED), confidence score, flip detection vs. previous recommendation, narrative explanation, top drivers/risks/flip conditions.',
    owner: 'Investment Committee',
    materialityTier: 'HIGH',
    methodology: '10 gates: (1) IRR > WACC+200bps, (2) NPV > 0, (3) Equity Multiple > 1.8x, (4) DSCR > 1.3x, (5) IRR > Target IRR, (6) Payback ≤ 8yr, (7) P(NPV<0) < 20%, (8) MC P10 IRR > 5%, (9) Factor Score > 3.0, (10) Budget Variance < 10%. Pass rate drives verdict: ≥85%=INVEST, ≥70%=HOLD, ≥50%=DE-RISK, ≥30%=EXIT, <30%=DO-NOT-PROCEED. Confidence = base from pass rate + IRR headroom bonus - MC spread penalty.',
    assumptions: [
      'Gate thresholds are calibrated for mid-market Indian hotel investments',
      'All gates have equal weight (not risk-weighted)',
      'Confidence score is additive (IRR headroom, MC spread) not multiplicative',
      'Flip detection compares against most recent previous recommendation',
    ],
    knownLimitations: [
      'Equal-weight gates — no priority for credit vs. equity metrics',
      'Gate thresholds are static — not adjusted by market cycle',
      'Confidence scoring is heuristic, not probabilistically calibrated',
      'Narrative is template-based, not ML-generated',
      'No LP preference customization (some LPs may have different thresholds)',
    ],
    approvedUseCases: [
      'Investment committee decision support',
      'Deal screening and pipeline prioritization',
      'Quarterly portfolio review and rebalancing signals',
    ],
    prohibitedUses: [
      'Automated trade execution without human IC review',
      'Regulatory capital allocation decisions',
      'Marketing to potential LPs as a "guaranteed" decision system',
    ],
    inputSchema: '{ deal, proformaResult, factorResult?, mcResult?, budgetResult?, currentRecommendation? }',
    outputSchema: '{ verdict, confidence, passRate, gateResults[], narrative, topDrivers[], topRisks[], flipConditions[], isFlip }',
    validationStatus: 'PENDING_VALIDATION',
    changeLog: [
      { version: '1.0.0', date: '2025-09-01', description: 'Initial 10-gate framework with 5 verdicts' },
      { version: '1.1.0', date: '2025-11-15', description: 'Added flip detection and narrative composition' },
      { version: '1.2.0', date: '2026-01-10', description: 'Added MC and Budget gate integration' },
      { version: '1.3.0', date: '2026-03-04', description: 'Added confidence scoring with IRR headroom and MC spread adjustments' },
    ],
  },
];

/**
 * Get model card by engine ID.
 */
export function getModelCard(engineId: string): ModelCard | undefined {
  return MODEL_INVENTORY.find(m => m.id === engineId);
}

/**
 * Get all models requiring validation (status is PENDING or EXPIRED).
 */
export function getModelsRequiringValidation(): ModelCard[] {
  return MODEL_INVENTORY.filter(m =>
    m.validationStatus === 'PENDING_VALIDATION' || m.validationStatus === 'EXPIRED'
  );
}
