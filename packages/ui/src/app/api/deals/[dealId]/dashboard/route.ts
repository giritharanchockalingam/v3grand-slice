import { NextResponse } from 'next/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;
  return NextResponse.json({
    dealId,
    kpis: {
      irr: 18.5,
      equityMultiple: 2.1,
      cashOnCash: 9.2,
      debtServiceCoverageRatio: 1.45,
      ltv: 0.65,
    },
    phases: [
      { name: 'Screening', status: 'completed' },
      { name: 'Underwriting', status: 'active' },
      { name: 'Due Diligence', status: 'pending' },
      { name: 'Closing', status: 'pending' },
      { name: 'Asset Management', status: 'pending' },
    ],
    alerts: [],
    recentActivity: [],
  });
}
