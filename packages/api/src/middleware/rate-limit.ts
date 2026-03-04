// ─── Rate Limiting & CORS Middleware ────────────────────────────────
// G-6/F-15: Per-IP and per-user rate limiting to prevent abuse.
// G-7/F-15: Explicit CORS configuration with origin whitelisting.
//
// Uses a simple in-memory sliding window. For production at scale,
// replace with Redis-backed rate limiting (e.g., @fastify/rate-limit with Redis store).

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

// ── In-memory rate limit store ──
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Extract rate limit key from request (IP + optional user ID).
 */
function getRateLimitKey(request: FastifyRequest): string {
  const ip = request.ip ?? request.headers['x-forwarded-for'] ?? 'unknown';
  const userId = (request as any).user?.userId;
  return userId ? `user:${userId}` : `ip:${ip}`;
}

/**
 * Rate limit hook — attach to Fastify as onRequest hook.
 */
export async function rateLimitHook(request: FastifyRequest, reply: FastifyReply) {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs;
  const max = config.rateLimitMax;

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  // Set rate limit headers
  reply.header('X-RateLimit-Limit', String(max));
  reply.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
  reply.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    reply.header('Retry-After', String(retryAfter));
    return reply.code(429).send({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    });
  }
}

/**
 * Register CORS and rate limiting on a Fastify instance.
 */
export function registerSecurityMiddleware(app: FastifyInstance) {
  // ── CORS ──
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const allowed = config.corsOrigins;

    if (origin && (allowed.includes('*') || allowed.includes(origin))) {
      reply.header('Access-Control-Allow-Origin', origin);
    } else if (allowed.length > 0 && !origin) {
      // Allow requests with no origin (e.g., server-to-server, Postman)
      reply.header('Access-Control-Allow-Origin', allowed[0]);
    }

    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Max-Age', '86400');

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return reply.code(204).send();
    }
  });

  // ── Rate Limiting ──
  app.addHook('onRequest', rateLimitHook);

  // ── Security Headers ──
  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    reply.header('Cache-Control', 'no-store');
  });
}
