// ─── JWT Authentication & Authorization Middleware ──────────────────
import { createHmac } from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthToken, User } from '@v3grand/core';

const JWT_SECRET = process.env.JWT_SECRET ?? 'v3grand-dev-secret';
const JWT_EXPIRY_SECONDS = 24 * 60 * 60; // 24 hours

interface DecodedJWT {
  header: Record<string, unknown>;
  payload: AuthToken;
  signature: string;
}

/**
 * Base64URL encode (no padding)
 */
function base64urlEncode(data: string | Buffer): string {
  const base64 = Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64urlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Restore padding
  const padding = 4 - (str.length % 4);
  if (padding !== 4) {
    base64 += '='.repeat(padding);
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Sign JWT token
 */
export function signToken(payload: Omit<AuthToken, 'iat' | 'exp'>): string {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: AuthToken = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const headerStr = base64urlEncode(JSON.stringify(header));
  const payloadStr = base64urlEncode(JSON.stringify(tokenPayload));

  const message = `${headerStr}.${payloadStr}`;
  const signature = createHmac('sha256', JWT_SECRET).update(message).digest();
  const signatureStr = base64urlEncode(signature);

  return `${message}.${signatureStr}`;
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): AuthToken | null {
  try {
    const [headerStr, payloadStr, signatureStr] = token.split('.');
    if (!headerStr || !payloadStr || !signatureStr) return null;

    // Verify signature
    const message = `${headerStr}.${payloadStr}`;
    const expectedSignature = base64urlEncode(
      createHmac('sha256', JWT_SECRET).update(message).digest()
    );

    if (signatureStr !== expectedSignature) return null;

    // Decode payload
    const payloadData = JSON.parse(base64urlDecode(payloadStr).toString('utf-8'));
    const now = Math.floor(Date.now() / 1000);

    // Check expiry
    if (payloadData.exp && payloadData.exp < now) return null;

    return payloadData as AuthToken;
  } catch (err) {
    return null;
  }
}

/**
 * Extract token from Bearer header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

/**
 * Fastify auth guard hook
 */
export async function authGuard(request: FastifyRequest, reply: FastifyReply) {
  const token = extractTokenFromHeader(request.headers.authorization);
  if (!token) {
    return reply.code(401).send({ error: 'Missing or invalid authorization header' });
  }

  const decoded = verifyToken(token);
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
 * Attach decoded user to request without throwing
 */
export async function attachUser(request: FastifyRequest, reply: FastifyReply) {
  const token = extractTokenFromHeader(request.headers.authorization);
  if (token) {
    const decoded = verifyToken(token);
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
 * Role-based access control
 */
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractTokenFromHeader(request.headers.authorization);
    if (!token) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' });
    }

    const decoded = verifyToken(token);
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
