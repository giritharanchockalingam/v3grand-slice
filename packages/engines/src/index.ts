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

// Shared utilities
export { createSeededRng, triangular, normalRandom, logNormal, clamp } from './_shared/distributions.js';
export { percentiles, buildHistogram } from './_shared/percentile.js';
