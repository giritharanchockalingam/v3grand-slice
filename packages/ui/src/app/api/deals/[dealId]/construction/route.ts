import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ dashboard: { changeOrders: [], rfis: [], milestones: [] } });
}
