/**
 * ─── Auth Store ──────────────────────────────────────────────────────
 * In-memory auth token store (no sessionStorage).
 * Simple module-level variable to hold JWT.
 * More secure than sessionStorage per the spec.
 */

/**
 * Internal token storage (module-scoped)
 */
let authToken: string | null = null;
let tokenExpireTime: number | null = null;

/**
 * Parse JWT payload without verification (for client-side use only)
 * Do NOT use for security validation
 */
function parseJWT(token: string): {
  exp?: number;
  [key: string]: unknown;
} | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64').toString('utf-8')
    );
    return decoded;
  } catch (err) {
    console.error('Failed to parse JWT:', err);
    return null;
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(token: string): boolean {
  const payload = parseJWT(token);
  if (!payload || typeof payload.exp !== 'number') {
    return true; // Treat as expired if we can't parse
  }

  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= now;
}

/**
 * Set auth token
 */
export function setAuthToken(token: string): void {
  if (isTokenExpired(token)) {
    console.warn('Token is already expired');
  }

  authToken = token;

  // Parse expiration time for refresh logic
  const payload = parseJWT(token);
  if (payload && typeof payload.exp === 'number') {
    tokenExpireTime = payload.exp * 1000; // Convert to milliseconds
  }

  console.log('[AuthStore] token set');
}

/**
 * Get auth token
 */
export function getAuthToken(): string | null {
  if (!authToken) {
    return null;
  }

  // Check if token has expired
  if (isTokenExpired(authToken)) {
    authToken = null;
    tokenExpireTime = null;
    return null;
  }

  return authToken;
}

/**
 * Clear auth token
 */
export function clearAuthToken(): void {
  authToken = null;
  tokenExpireTime = null;
  console.log('[AuthStore] token cleared');
}

/**
 * Check if authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthToken() !== null;
}

/**
 * Get token expiration time (milliseconds since epoch)
 */
export function getTokenExpireTime(): number | null {
  return tokenExpireTime;
}

/**
 * Get time until token expires (in milliseconds)
 */
export function getTimeUntilExpiry(): number | null {
  if (!tokenExpireTime) {
    return null;
  }

  const timeRemaining = tokenExpireTime - Date.now();
  return timeRemaining > 0 ? timeRemaining : null;
}

/**
 * Check if token will expire soon (within threshold)
 */
export function willTokenExpireSoon(thresholdMs: number = 5 * 60 * 1000): boolean {
  const timeUntilExpiry = getTimeUntilExpiry();
  if (timeUntilExpiry === null) {
    return false; // Not authenticated
  }
  return timeUntilExpiry < thresholdMs;
}

// Export for use in api-client
export type { AuthStore as _AuthStore };
type AuthStore = typeof setAuthToken;
