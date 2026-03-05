import { NextResponse } from 'next/server';

/**
 * Demo deals data for deployed preview (no backend required).
 * In production with a real backend, set NEXT_PUBLIC_API_URL to point to it.
 */
const DEMO_DEALS = [
  {
    id: 'demo-deal-001',
    name: 'Marina Bay Tower',
    assetClass: 'Mixed-Use',
    status: 'active',
    lifecyclePhase: 'Underwriting',
    updatedAt: new Date().toISOString(),
    userRole: 'lead-investor',
    city: 'Chennai',
    totalInvestment: 125000000,
    targetIrr: 18.5,
  },
  {
    id: 'demo-deal-002',
    name: 'Grand Madurai Heritage',
    assetClass: 'Hospitality',
    status: 'active',
    lifecyclePhase: 'Due Diligence',
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    userRole: 'lead-investor',
    city: 'Madurai',
    totalInvestment: 85000000,
    targetIrr: 22.0,
  },
  {
    id: 'demo-deal-003',
    name: 'Coimbatore Tech Park',
    assetClass: 'Commercial',
    status: 'draft',
    lifecyclePhase: 'Screening',
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
    userRole: 'co-investor',
    city: 'Coimbatore',
    totalInvestment: 200000000,
    targetIrr: 15.0,
  },
];

export async function GET() {
  return NextResponse.json(DEMO_DEALS);
}

export async function POST(request: Request) {
  const body = await request.json();
  const newDeal = {
    id: `demo-deal-${Date.now()}`,
    ...body,
    status: 'draft',
    lifecyclePhase: 'Screening',
    updatedAt: new Date().toISOString(),
    userRole: 'lead-investor',
  };
  return NextResponse.json(newDeal, { status: 201 });
}
