// ─── JWT Authentication & Authorization Middleware ──────────────────
// G-5/F-5: Uses the `jose` library for standards-compliant JWT handling.
// Replaces hand-rolled base64url + HMAC with auditable, battle-tested code.
// Supports HS256 (HMAC-SHA256) signing with proper JOSE header validation.
//
// jose: https://github.com/panva/jose — 0-dependency, TypeScript-native,
// used by Auth.js / NextAuth / Supabase / Cloudflare Workers.

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthToken, User } from '@v3grand/core';
import { config } from '../config.js';

// ── Secret encoding ──
// jose requires Uint8Array for symmetric keys
const JWT_SECRET = new TextEncoder().encode(config.jwtSecret);
const JWT_EXPIRY = '24h';
const JWT_ISSUER = 'v3grand-api';
const JWT_AUDIENCE = 'v3grand-app';

interface DecodedPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token using jose (HS256).
 * Sets standard claims: iss, aud, iat, exp, jti (unique ID).
 */
export async function signToken(payload: Omit<AuthToken, 'iat' | 'exp'>): Promise<string> {
  const jwt = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(crypto.randomUUID())
    .sign(JWT_SECRET);

  return jwt;
}

/**
 * Verify and decode a JWT token using jose.
 * Validates: signature, expiry, issuer, audience, required claims.
 */
export async function verifyToken(token: string): Promise<DecodedPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
      requiredClaims: ['userId', 'email', 'role'],
    });

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch (err) {
    // Distinguish error types for observability
    if (err instanceof joseErrors.JWTExpired) {
      // Token expired — normal for long-lived sessions
      return null;
    }
    if (err instanceof joseErrors.JWTClaimValidationFailed) {
      // Missing or invalid claims (issuer, audience mismatch)
      return null;
    }
    if (err instanceof joseErrors.JWSSignatureVerificationFailed) {
      // Tampered token or wrong secret
      return null;
    }
    // Unknown error — still return null for safety
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Fastify auth guard hook — rejects unauthenticated requests.
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = extractTokenFromHeader(request.headers.authorization);
  if (!token) {
    return reply.code(401).send({ error: 'Missing or invalid authorization header' });
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }

  // Attach user info to request
  (request as any).user = {
    userId: decoded.userId,
    email: decoded.email,
    role: decoded.role,
  };
}

/**
 * Soft auth — attaches user if valid token present, doesn't reject.
 */
export async function attachUser(request: FastifyRequest, reply: FastifyReply) {
  const token = extractTokenFromHeader(request.headers.authorization);
  if (token) {
    const decoded = await verifyToken(token);
    if (decoded) {
      (request as any).user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    }
  }
}

/**
 * Role-based access control — guard that checks for specific roles.
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' });
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    if (!roles.includes(decoded.role)) {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }

    (request as any).user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  };
}
