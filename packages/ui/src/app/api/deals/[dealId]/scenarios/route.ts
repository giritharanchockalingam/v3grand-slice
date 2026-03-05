import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ scenarios: [], activeScenarioKey: null });
}
