// ─── Hash Chain: Cryptographic Tamper-Evidence for Engine Results ────
// G-2/F-3: Each engine result contains SHA-256(previousHash + engineName + version + input + output)
// This creates an immutable linked list — if any historical result is modified,
// all subsequent hashes become invalid, providing tamper evidence.
//
// Usage: call computeContentHash() before inserting each engine result,
// passing the previousHash from the most recent result for the same engine+deal+scenario.

import { createHash } from 'crypto';

export interface HashableEngineResult {
  engineName: string;
  version: number;
  scenarioKey: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}

/**
 * Compute the SHA-256 content hash for an engine result.
 * The hash covers: previousHash + engineName + scenarioKey + version + canonical(input) + canonical(output)
 *
 * @param previousHash - The contentHash of the previous result in the chain ('genesis' for the first)
 * @param result - The engine result to hash
 * @returns 64-character lowercase hex SHA-256 digest
 */
export function computeContentHash(
  previousHash: string,
  result: HashableEngineResult,
): string {
  const canonical = [
    previousHash,
    result.engineName,
    result.scenarioKey,
    String(result.version),
    canonicalize(result.input),
    canonicalize(result.output),
  ].join('|');

  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * Verify that a chain of engine results has not been tampered with.
 * Returns { valid: true } if all hashes are consistent, or
 * { valid: false, brokenAt: index } if a hash mismatch is found.
 */
export function verifyHashChain(
  results: Array<{
    contentHash: string;
    previousHash: string;
    engineName: string;
    version: number;
    scenarioKey: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
  }>
): { valid: boolean; brokenAt?: number; expected?: string; actual?: string } {
  for (let i = 0; i < results.length; i++) {
    const r = results[i];

    // Verify content hash matches the computed value
    const expectedHash = computeContentHash(r.previousHash, {
      engineName: r.engineName,
      version: r.version,
      scenarioKey: r.scenarioKey,
      input: r.input,
      output: r.output,
    });

    if (expectedHash !== r.contentHash) {
      return { valid: false, brokenAt: i, expected: expectedHash, actual: r.contentHash };
    }

    // Verify chain linkage (except first item)
    if (i > 0 && r.previousHash !== results[i - 1].contentHash) {
      return { valid: false, brokenAt: i, expected: results[i - 1].contentHash, actual: r.previousHash };
    }
  }

  return { valid: true };
}

/**
 * Canonical JSON serialization (sorted keys, no whitespace).
 * Ensures the same object always produces the same hash regardless of property order.
 */
function canonicalize(obj: unknown): string {
  return JSON.stringify(obj, Object.keys(obj as object).sort());
}

/**
 * Engine model versions — semantic version registry (G-10/F-4).
 * Updated whenever engine logic changes materially.
 * Used to tag engine results so auditors can determine which model version produced a result.
 */
export const MODEL_VERSIONS: Record<string, string> = {
  factor:      '1.2.0',  // 4-domain weighted scoring, Madurai-specific local scoring
  underwriter: '1.1.0',  // 10-year pro forma with Phase 2, level annuity debt
  montecarlo:  '1.0.0',  // 5K iterations, triangular + lognormal, Pearson sensitivity
  budget:      '1.0.0',  // Line-level RAG variance, change order tracking
  scurve:      '1.0.0',  // Logistic + Beta distribution CAPEX curves
  decision:    '1.3.0',  // 10-gate framework, flip detection, narrative composition
};
