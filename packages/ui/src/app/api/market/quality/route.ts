import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, quality: { score: 0.85, status: 'good' } });
}
