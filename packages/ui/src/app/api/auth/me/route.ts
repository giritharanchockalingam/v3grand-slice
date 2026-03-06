import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { requireAuth } from '@/lib/server/auth';
import { getUserById } from '@v3grand/db';

export async function GET(request: Request) {
  try {
    const authUser = await requireAuth(request);
    const db = getDb();
    const user = await getUserById(db, authUser.userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : String(user.createdAt),
    });
  } catch (err) {
    if (err instanceof Response) return new NextResponse(err.body, { status: err.status, headers: err.headers });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
