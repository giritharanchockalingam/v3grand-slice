// ─── @v3grand/core barrel export ────────────────────────────────────
// Domain Types
export * from './types/deal.js';
export * from './types/auth.js';
export * from './types/construction.js';
export * from './types/events.js';
export * from './types/risk.js';

// Engine types (primary source for RecommendationState, RecommendationVerdict)
export * from './types/engine.js';

// Unified evaluation types (generic pipeline + asset plugin interface)
export * from './types/evaluation.js';

// Recommendation support types (re-exports RecommendationVerdict + snapshot types)
export * from './types/recommendation.js';

// Lifecycle types (exports LifecyclePhase, Task, LifecycleView, etc)
export * from './types/lifecycle.js';

// Data Transfer Objects
export * from './dto/views.js';

// Schemas & Utils
export * from './schemas/assumptions.js';
export * from './logger.js';
