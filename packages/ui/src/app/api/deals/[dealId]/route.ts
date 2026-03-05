import { NextResponse } from 'next/server';

const DEMO_DEAL = {
  id: 'demo-deal-001',
  name: 'Marina Bay Tower',
  assetClass: 'Mixed-Use',
  status: 'active',
  lifecyclePhase: 'Underwriting',
  city: 'Chennai',
  totalInvestment: 125000000,
  targetIrr: 18.5,
  targetEquityMultiple: 2.1,
  holdPeriod: 5,
  updatedAt: new Date().toISOString(),
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  assumptions: {},
  userRole: 'lead-investor',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  return NextResponse.json({ ...DEMO_DEAL, id: dealId });
}
