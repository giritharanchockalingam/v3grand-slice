import { NextResponse } from 'next/server';
import { scryptSync, randomBytes } from 'crypto';
import { getDb } from '@/lib/server/db';
import { signToken } from '@/lib/server/auth';
import { getUserByEmail } from '@v3grand/db';

function verifyPassword(password: string, hash: string): boolean {
  const [saltHex, hashHex] = hash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const derivedHash = scryptSync(password, salt, 64);
  return derivedHash.toString('hex') === hashHex;
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const db = getDb();
    const user = await getUserByEmail(db, email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({
      userId: String(user.id),
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
      },
      token,
    });
  } catch (err) {
    console.error('auth/login failed:', err);
    return NextResponse.json(
      { error: 'Login failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
