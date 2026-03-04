// ─── Resilient HTTP Client ──────────────────────────────────────────
// Retry with exponential backoff + circuit breaker pattern.

interface FetchOptions {
  headers?: Record<string, string>;
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

interface CircuitState {
  failures: number;
  lastFailure: number;
  state: 'closed' | 'open' | 'half-open';
}

const circuits = new Map<string, CircuitState>();
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 60_000;

function getCircuit(host: string): CircuitState {
  if (!circuits.has(host)) {
    circuits.set(host, { failures: 0, lastFailure: 0, state: 'closed' });
  }
  return circuits.get(host)!;
}

function getHost(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { retries = 3, timeoutMs = 8000, backoffMs = 1000 } = options;
  const host = getHost(url);
  const circuit = getCircuit(host);

  // Circuit breaker check
  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailure > RESET_TIMEOUT_MS) {
      circuit.state = 'half-open';
    } else {
      throw new Error(`Circuit breaker OPEN for ${host}. Retry after ${Math.ceil((RESET_TIMEOUT_MS - (Date.now() - circuit.lastFailure)) / 1000)}s`);
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        headers: options.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Success — reset circuit
      if (circuit.state === 'half-open') {
        circuit.state = 'closed';
        circuit.failures = 0;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < retries) {
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // Record failure in circuit breaker
  circuit.failures++;
  circuit.lastFailure = Date.now();
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = 'open';
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${retries + 1} attempts`);
}

/** Reset all circuit breakers (useful for testing) */
export function resetCircuits(): void {
  circuits.clear();
}
