// ─── Statistical Distribution Functions ────────────────────────────
// Pure math utilities for Monte Carlo simulation.
// No I/O, no framework dependencies.

/**
 * Create a seeded pseudo-random number generator (Mulberry32).
 * Returns a function () => number in [0, 1).
 */
export function createSeededRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Triangular distribution sample.
 * @param min - Minimum value
 * @param mode - Most likely value (peak)
 * @param max - Maximum value
 * @param rng - Random number generator [0,1)
 */
export function triangular(min: number, mode: number, max: number, rng: () => number): number {
  const u = rng();
  const fc = (mode - min) / (max - min);
  if (u < fc) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  } else {
    return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

/**
 * Standard normal random variate via Box-Muller transform.
 * Returns a single N(0,1) sample.
 */
export function normalRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2);
}

/**
 * Log-normal sample: exp(ln(median) + sigma * Z)
 * @param median - Median of the distribution
 * @param sigma - Standard deviation of the underlying normal
 * @param rng - Random number generator
 */
export function logNormal(median: number, sigma: number, rng: () => number): number {
  const z = normalRandom(rng);
  return Math.exp(Math.log(median) + sigma * z);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
