/**
 * Server-side JWT auth helpers for Next.js API routes.
 * Mirrors the Fastify middleware/auth.ts logic but for Next.js handlers.
 */
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { headers } from 'next/headers';

const JWT_EXPIRY = '24h';
const JWT_ISSUER = 'v3grand-api';
const JWT_AUDIENCE = 'v3grand-app';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'v3grand-dev-secret-change-in-prod';
  return new TextEncoder().encode(secret);
}

interface DecodedPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export async function signToken(payload: { userId: string; email: string; role: string }): Promise<string> {
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
    .sign(getJwtSecret());
  return jwt;
}

export async function verifyToken(token: string): Promise<DecodedPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
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
  } catch {
    return null;
  }
}

/**
 * Extract and verify the Bearer token from the request.
 * Returns the decoded payload or null if unauthenticated.
 */
export async function getAuthUser(request: Request): Promise<DecodedPayload | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  return verifyToken(match[1]);
}

/**
 * Require authentication — returns user or throws 401 Response.
 */
export async function requireAuth(request: Request): Promise<DecodedPayload> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}
