/**
 * ─── API Client ─────────────────────────────────────────────────────
 * Centralized API client with auth token injection,
 * error handling, and base URL configuration.
 */

import { getAuthToken, willTokenExpireSoon } from './auth-store';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request<T = any>(
  method: string,
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { params, body, headers: customHeaders, ...rest } = options;

  // Build URL with query params
  let url = `${BASE_URL}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  // Inject auth token
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Warn if token expiring soon
  if (willTokenExpireSoon(2 * 60 * 1000)) {
    console.warn('[ApiClient] Auth token expiring in <2 minutes');
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    ...rest,
  });

  let data: T;
  try {
    data = await response.json();
  } catch {
    data = {} as T;
  }

  if (!response.ok) {
    const error = new Error(`API Error ${response.status}: ${response.statusText}`);
    (error as any).status = response.status;
    (error as any).data = data;
    throw error;
  }

  return data;
}

export const apiClient = {
  get: <T = any>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>('GET', path, options),
  post: <T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> =>
    request<T>('POST', path, { ...options, body }),
  put: <T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> =>
    request<T>('PUT', path, { ...options, body }),
  patch: <T = any>(path: string, body?: any, options?: RequestOptions): Promise<T> =>
    request<T>('PATCH', path, { ...options, body }),
  delete: <T = any>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>('DELETE', path, options),
};

// Backward-compatible alias — existing components import { api }
export const api = apiClient;
