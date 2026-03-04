// ─── Authentication Routes ────────────────────────────────────────
import { scryptSync, randomBytes } from 'crypto';
import type { FastifyInstance } from 'fastify';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { getUserByEmail, getUserById } from '@v3grand/db';
import { signToken, authGuard } from '../middleware/auth.js';
import { config } from '../config.js';

const SALT_ROUNDS = 10;

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, hash: string): boolean {
  const [saltHex, hashHex] = hash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const derivedHash = scryptSync(password, salt, 64);
  return derivedHash.toString('hex') === hashHex;
}

export async function authRoutes(app: FastifyInstance, db: PostgresJsDatabase) {

  // ── POST /auth/login ──
  app.post<{
    Body: { email: string; password: string };
  }>('/auth/login', async (req, reply) => {
    try {
      const { email, password } = req.body ?? {};

      if (!email || !password) {
        return reply.code(400).send({ error: 'Email and password required' });
      }

      const user = await getUserByEmail(db, email);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = signToken({
        userId: String(user.id),
        email: user.email,
        role: user.role as any,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
        },
        token,
      };
    } catch (err) {
      req.log.error({ err }, 'auth/login failed');
      return reply.code(500).send({
        error: 'Login failed',
        ...(!config.isProd && { details: err instanceof Error ? err.message : String(err) }),
      });
    }
  });

  // ── GET /auth/me ──
  app.get('/auth/me', { preHandler: authGuard }, async (req, reply) => {
    const user = await getUserById(db, (req as any).user.userId);
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  });
}

export { hashPassword, verifyPassword };
