// ─── Recommendation / Decision Support Types ────────────────────────
// These types provide supporting structures for the engine.RecommendationState
// Re-export the verdict type from engine for convenience
export type { RecommendationVerdict } from './engine.js';

// Supporting snapshot types used within RecommendationState
export interface FactorSnapshotData {
  compositeScore: number;
  impliedDiscountRate: number;
  impliedCapRate: number;
}

export interface ProFormaSnapshotData {
  irr: number;
  npv: number;
  equityMultiple: number;
  dscr: number;
}

export interface MCSnapshotData {
  p10Irr: number;
  p50Irr: number;
  p90Irr: number;
  probNpvNeg: number;
}

export interface GateCheckResult {
  name: string;
  passed: boolean;
  actual: number;
  threshold: number;
}
