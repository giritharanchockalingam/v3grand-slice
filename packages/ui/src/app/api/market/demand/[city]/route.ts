import { NextResponse } from 'next/server';

/**
 * GET /api/market/demand/[city]
 * Returns demand signal indicators for a city.
 * In production this would aggregate from multiple external APIs;
 * for now returns computed estimates per city tier.
 */

const DEMAND_DATA: Record<string, {
  touristGrowthPct: number;
  airTrafficGrowthPct: number;
  gdpGrowthPct: number;
  compositeScore: number;
}> = {
  madurai: { touristGrowthPct: 8.2, airTrafficGrowthPct: 12.5, gdpGrowthPct: 7.8, compositeScore: 72 },
  chennai: { touristGrowthPct: 7.1, airTrafficGrowthPct: 9.5, gdpGrowthPct: 8.2, compositeScore: 78 },
  bangalore: { touristGrowthPct: 9.5, airTrafficGrowthPct: 11.2, gdpGrowthPct: 9.8, compositeScore: 85 },
  mumbai: { touristGrowthPct: 6.5, airTrafficGrowthPct: 7.8, gdpGrowthPct: 7.5, compositeScore: 74 },
  hyderabad: { touristGrowthPct: 10.2, airTrafficGrowthPct: 13.0, gdpGrowthPct: 9.0, compositeScore: 82 },
  delhi: { touristGrowthPct: 5.8, airTrafficGrowthPct: 6.8, gdpGrowthPct: 7.0, compositeScore: 70 },
  kolkata: { touristGrowthPct: 6.0, airTrafficGrowthPct: 8.3, gdpGrowthPct: 6.5, compositeScore: 62 },
  pune: { touristGrowthPct: 11.0, airTrafficGrowthPct: 14.5, gdpGrowthPct: 8.5, compositeScore: 80 },
  varanasi: { touristGrowthPct: 12.5, airTrafficGrowthPct: 18.0, gdpGrowthPct: 7.2, compositeScore: 76 },
};

function lookupCity(city: string) {
  const key = city.toLowerCase().trim();
  if (DEMAND_DATA[key]) return DEMAND_DATA[key];
  const found = Object.keys(DEMAND_DATA).find(k => key.includes(k) || k.includes(key));
  if (found) return DEMAND_DATA[found];
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ city: string }> }
) {
  try {
    const { city } = await params;
    const signals = lookupCity(decodeURIComponent(city));

    if (!signals) {
      // Generic demand signals for unknown cities
      return NextResponse.json({
        ok: true,
        data: {
          touristGrowthPct: 6.0,
          airTrafficGrowthPct: 8.0,
          gdpGrowthPct: 7.0,
          compositeScore: 55,
        },
      });
    }

    return NextResponse.json({ ok: true, data: signals });
  } catch (err) {
    console.error('GET /api/market/demand/[city] failed:', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch demand signals' }, { status: 500 });
  }
}
