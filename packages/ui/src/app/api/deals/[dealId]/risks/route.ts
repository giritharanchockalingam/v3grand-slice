import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ risks: [] });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ id: `risk-${Date.now()}`, ...body }, { status: 201 });
}
