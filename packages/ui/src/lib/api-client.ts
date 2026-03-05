// ─── Typed API Client ───────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem('v3grand-auth');
    if (!stored) return null;
    const { token } = JSON.parse(stored);
    return token ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const base = API_BASE.replace(/\/$/, '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  let res: Response;
  try {
    res = await fetch(url, { ...opts, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'Failed to fetch' || msg.includes('NetworkError') || msg.includes('Load failed')) {
      throw new Error(
        `Cannot reach the API. Start the server (e.g. pnpm --filter @v3grand/api run dev) and ensure it is running on ${base}.`,
      );
    }
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string | { code?: string; message?: string }; details?: unknown };
    const msg = typeof body?.error === 'object' && body?.error?.message
      ? body.error.message
      : (typeof body?.error === 'string' ? body.error : undefined) ?? `API error: ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body !== undefined ? body : {}),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
