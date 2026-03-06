import { NextResponse } from 'next/server';

export async function GET() {
  // Market macro data - uses MCP fallback mode defaults
  return NextResponse.json({
    ok: true,
    data: {
      repoRate: 6.50,
      cpi: 5.10,
      gdpGrowth: 6.80,
      usdInr: 83.50,
      source: 'fallback',
      timestamp: new Date().toISOString(),
    },
  });
}
