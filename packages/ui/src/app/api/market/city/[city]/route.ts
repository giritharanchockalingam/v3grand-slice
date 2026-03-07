import { NextResponse } from 'next/server';

/**
 * GET /api/market/city/[city]
 * Returns city-level market profile data for hotel investment analysis.
 * In production this would fetch from external data sources;
 * for now returns computed estimates from city profiles.
 */

const CITY_DATA: Record<string, {
  state: string;
  airportPassengers: number;
  airportGrowthPct: number;
  touristArrivals: { domestic: number; foreign: number; growthPct: number };
  housingPriceIndex: number;
  housingGrowthPct: number;
  demandOutlook: 'strong' | 'moderate' | 'weak';
}> = {
  madurai: {
    state: 'Tamil Nadu', airportPassengers: 2_800_000, airportGrowthPct: 12.5,
    touristArrivals: { domestic: 15_000_000, foreign: 180_000, growthPct: 8.2 },
    housingPriceIndex: 105, housingGrowthPct: 6.8, demandOutlook: 'strong',
  },
  chennai: {
    state: 'Tamil Nadu', airportPassengers: 22_000_000, airportGrowthPct: 9.5,
    touristArrivals: { domestic: 35_000_000, foreign: 5_200_000, growthPct: 7.1 },
    housingPriceIndex: 125, housingGrowthPct: 5.2, demandOutlook: 'strong',
  },
  bangalore: {
    state: 'Karnataka', airportPassengers: 35_000_000, airportGrowthPct: 11.2,
    touristArrivals: { domestic: 20_000_000, foreign: 1_500_000, growthPct: 9.5 },
    housingPriceIndex: 145, housingGrowthPct: 8.1, demandOutlook: 'strong',
  },
  mumbai: {
    state: 'Maharashtra', airportPassengers: 50_000_000, airportGrowthPct: 7.8,
    touristArrivals: { domestic: 28_000_000, foreign: 5_800_000, growthPct: 6.5 },
    housingPriceIndex: 190, housingGrowthPct: 4.2, demandOutlook: 'moderate',
  },
  hyderabad: {
    state: 'Telangana', airportPassengers: 25_000_000, airportGrowthPct: 13.0,
    touristArrivals: { domestic: 18_000_000, foreign: 1_200_000, growthPct: 10.2 },
    housingPriceIndex: 115, housingGrowthPct: 7.5, demandOutlook: 'strong',
  },
  delhi: {
    state: 'Delhi', airportPassengers: 72_000_000, airportGrowthPct: 6.8,
    touristArrivals: { domestic: 30_000_000, foreign: 15_000_000, growthPct: 5.8 },
    housingPriceIndex: 160, housingGrowthPct: 3.9, demandOutlook: 'moderate',
  },
  kolkata: {
    state: 'West Bengal', airportPassengers: 20_000_000, airportGrowthPct: 8.3,
    touristArrivals: { domestic: 12_000_000, foreign: 800_000, growthPct: 6.0 },
    housingPriceIndex: 100, housingGrowthPct: 4.5, demandOutlook: 'moderate',
  },
  pune: {
    state: 'Maharashtra', airportPassengers: 12_000_000, airportGrowthPct: 14.5,
    touristArrivals: { domestic: 8_000_000, foreign: 300_000, growthPct: 11.0 },
    housingPriceIndex: 120, housingGrowthPct: 6.5, demandOutlook: 'strong',
  },
  varanasi: {
    state: 'Uttar Pradesh', airportPassengers: 3_500_000, airportGrowthPct: 18.0,
    touristArrivals: { domestic: 25_000_000, foreign: 500_000, growthPct: 12.5 },
    housingPriceIndex: 85, housingGrowthPct: 8.0, demandOutlook: 'strong',
  },
};

function lookupCity(city: string) {
  const key = city.toLowerCase().trim();
  if (CITY_DATA[key]) return CITY_DATA[key];
  const found = Object.keys(CITY_DATA).find(k => key.includes(k) || k.includes(key));
  if (found) return CITY_DATA[found];
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ city: string }> }
) {
  try {
    const { city } = await params;
    const profile = lookupCity(decodeURIComponent(city));

    if (!profile) {
      // Return a generic profile for unknown cities
      return NextResponse.json({
        ok: true,
        data: {
          city: decodeURIComponent(city),
          state: 'India',
          airportPassengers: 1_000_000,
          airportGrowthPct: 8.0,
          touristArrivals: { domestic: 2_000_000, foreign: 50_000, growthPct: 6.0 },
          housingPriceIndex: 90,
          housingGrowthPct: 5.0,
          demandOutlook: 'moderate' as const,
          fetchedAt: new Date().toISOString(),
          source: 'estimated',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        city: decodeURIComponent(city),
        ...profile,
        fetchedAt: new Date().toISOString(),
        source: 'internal-data',
      },
    });
  } catch (err) {
    console.error('GET /api/market/city/[city] failed:', err);
    return NextResponse.json({ ok: false, error: 'Failed to fetch city profile' }, { status: 500 });
  }
}
