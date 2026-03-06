// ─── @v3grand/engines barrel export ─────────────────────────────────
export { buildProForma } from './underwriter/index.js';
export { evaluate as evaluateDecision } from './decision/index.js';
export { calcIRR, calcNPV } from './_shared/irr.js';

// Factor scoring
export { scoreFactors } from './factor/index.js';

// Monte Carlo simulation
export { runMonteCarlo } from './montecarlo/index.js';

// Budget variance analysis
export { analyzeBudget } from './budget/index.js';

// S-Curve CAPEX distribution
export { distribute as distributeSCurve } from './scurve/index.js';

// Unified Deal Evaluation Engine
export { evaluateDeal } from './evaluation/index.js';
export { hotelPlugin } from './evaluation/plugins/hotel.js';
export { generateICMemoPDF } from './evaluation/ic-memo.js';

// G-2/F-3: Hash chain & model version registry
export { computeContentHash, verifyHashChain, MODEL_VERSIONS, computeAssumptionFingerprint } from './integrity/hash-chain.js';

// G-9/F-1: Model validation framework
export { runBacktest, runChampionChallenger } from './validation/model-validator.js';
export type { ValidationCase, ValidationResult, ValidationMetrics } from './validation/model-validator.js';

// G-8/F-12: Model inventory register
export { MODEL_INVENTORY, getModelCard, getModelsRequiringValidation } from './validation/model-inventory.js';
export type { ModelCard } from './validation/model-inventory.js';

// F-7: Stress testing & reverse stress testing
export { runScenarioShocks, runReverseStressTest, runSensitivitySweep, INSTITUTIONAL_SHOCKS } from './stress/stress-test.js';
export type { ShockResult, SensitivityResult, ReverseStressResult } from './stress/stress-test.js';

// G-1/F-10: Multi-asset class profiles
export { getAssetClassProfile, registerAssetClassProfile, listAssetClassProfiles, HOTEL_PROFILE, COMMERCIAL_OFFICE_PROFILE } from './factor/asset-profiles.js';
export type { AssetClassProfile, DomainWeights } from './factor/asset-profiles.js';

// Shared utilities
export { createSeededRng, triangular, normalRandom, logNormal, clamp } from './_shared/distributions.js';
export { percentiles, buildHistogram } from './_shared/percentile.js';
