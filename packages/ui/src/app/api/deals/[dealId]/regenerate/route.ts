/**
 * POST /api/deals/[dealId]/regenerate
 *
 * Regenerates AI-driven construction budget lines, milestones, and risk data
 * for an existing deal. Uses Claude to generate structured data based on the
 * deal's stored context (property details, financials, market assumptions).
 *
 * This is the standalone equivalent of the post-analysis wiring in invest/analyze,
 * for deals that already exist but need their construction + risk data refreshed.
 *
 * Body: { types?: ('construction' | 'risks')[] }  — defaults to both
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getDealById,
  createBudgetLine,
  createMilestone,
  createRisk,
  insertAuditEntry,
} from '@v3grand/db';

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealId: string }> }
) {
  try {
    const { dealId } = await params;
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const types: string[] = body.types ?? ['construction', 'risks'];

    const result = await withRLS(user.userId, user.role, async (db) => {
      const deal = await getDealById(db, dealId);
      if (!deal) return { ok: false, error: 'Deal not found' };

      const dealData = deal as any;
      const property = dealData.property ?? {};
      const capex = dealData.capexPlan ?? {};
      const financials = dealData.financialAssumptions ?? {};
      const market = dealData.marketAssumptions ?? {};
      const scenarios = dealData.scenarios ?? {};

      const propertyName = deal.name ?? 'Unknown';
      const city = property.city ?? property.location?.city ?? 'Unknown';
      const state = property.state ?? property.location?.state ?? 'Unknown';
      const roomCount = property.roomCount ?? property.rooms ?? 50;
      const starRating = property.starRating ?? property.rating ?? 3;
      const propertyType = property.type ?? property.propertyType ?? 'hotel';
      const dealType = dealData.dealType ?? 'new_build';
      const investmentCr = capex.totalCr ?? capex.totalInvestmentCr ??
        (financials.totalInvestment ? financials.totalInvestment / 1e7 : 100);
      const constructionBudgetCr = capex.constructionCr ?? investmentCr * 0.85;

      // Demand mix from market assumptions
      const demandMix = market.demandMix ?? {};
      const demandCtx = `Demand mix: Corporate ${demandMix.corporate ?? 20}%, Medical ${demandMix.medical ?? 25}%, Leisure ${demandMix.leisure ?? 35}%, MICE ${demandMix.mice ?? 20}%.`;

      // Base scenario context
      const baseScenario = scenarios.base ?? {};
      const scenarioCtx = `Base scenario: ${baseScenario.occupancy ?? 68}% occupancy, ₹${baseScenario.adr ?? 6800} ADR, ${baseScenario.ebitdaMargin ?? 32}% EBITDA margin.`;

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const results: { construction?: any; risks?: any } = {};

      // ── Generate Construction Data ──
      if (types.includes('construction')) {
        try {
          const resp = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: `You are a construction cost estimator for Indian hotel projects. Generate realistic construction budget lines and milestones based on the deal parameters.

Return ONLY valid JSON in this exact format:
{
  "budgetLines": [
    { "costCode": "CIV-001", "description": "Foundation & Piling", "category": "civil", "amountCr": 5.0 },
    ...
  ],
  "milestones": [
    { "name": "Land Acquisition & Clearances", "description": "Detailed description", "targetMonthsFromNow": 0, "status": "completed", "percentComplete": 100 },
    ...
  ]
}

Rules:
- Budget lines must sum to approximately ₹${constructionBudgetCr.toFixed(1)} Cr
- Use realistic Indian cost codes: CIV (civil), MEP (mechanical/electrical/plumbing), FIN (finishes), LND (land), SOF (soft costs), FFE (furniture/fixtures), EXT (exterior/landscaping)
- For ${dealType === 'new_build' ? 'new builds' : dealType}: include all typical phases
- ${roomCount} rooms, ${starRating}-star ${propertyType} in ${city}, ${state}
- Include 8-12 budget lines covering all major categories
- Milestones should reflect realistic Indian hotel construction timeline (8-12 milestones)
- For new builds: ~24-36 months. For renovation: ~12-18 months
- Early milestones can be "completed" or "in-progress", later ones "not-started"`,
            messages: [{
              role: 'user',
              content: `Generate construction budget and milestones for:

Property: ${propertyName} — ${roomCount} rooms, ${starRating}-star ${propertyType}
Location: ${city}, ${state}
Total Investment: ₹${investmentCr.toFixed(1)} Cr (construction budget ~₹${constructionBudgetCr.toFixed(1)} Cr)
Deal Type: ${dealType}
${demandCtx}
${scenarioCtx}

Financial context: WACC ${(financials.wacc ?? 0.11) * 100}%, Debt interest ${(financials.debtInterestRate ?? 0.095) * 100}%, D/E ratio ${financials.debtEquityRatio ?? '50/50'}

Generate realistic construction budget lines and milestones. Respond with ONLY valid JSON.`,
            }],
          });

          const text = resp.content
            .filter(b => b.type === 'text')
            .map(b => 'text' in b ? (b as { text: string }).text : '')
            .join('');
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            // Persist budget lines
            let budgetCount = 0;
            for (const bl of (parsed.budgetLines ?? [])) {
              const amountPaise = Math.round(bl.amountCr * 1e7);
              await createBudgetLine(db, {
                dealId,
                costCode: bl.costCode,
                description: bl.description,
                category: bl.category,
                originalAmount: amountPaise,
                currentBudget: amountPaise,
              });
              budgetCount++;
            }

            // Persist milestones
            let milestoneCount = 0;
            for (const ms of (parsed.milestones ?? [])) {
              const targetDate = new Date();
              targetDate.setMonth(targetDate.getMonth() + (ms.targetMonthsFromNow ?? 0));
              await createMilestone(db, {
                dealId,
                name: ms.name,
                description: ms.description ?? ms.name,
                targetDate: targetDate.toISOString().split('T')[0],
                status: ms.status ?? 'not-started',
                percentComplete: ms.percentComplete ?? 0,
              });
              milestoneCount++;
            }

            results.construction = { budgetLines: budgetCount, milestones: milestoneCount };
          }
        } catch (err: any) {
          results.construction = { error: err.message };
          console.error('Construction generation failed:', err);
        }
      }

      // ── Generate Risk Data ──
      if (types.includes('risks')) {
        try {
          const resp = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: `You are a risk analyst for Indian hotel investments. Generate comprehensive risk items based on the deal parameters and market context.

Return ONLY valid JSON in this exact format:
{
  "risks": [
    {
      "title": "Short descriptive title",
      "description": "Detailed risk description with specific numbers/context",
      "category": "market|construction|financial|regulatory|operational",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high",
      "mitigation": "Specific mitigation strategy",
      "owner": "Role responsible (e.g. CFO, Project Manager, Legal Counsel)"
    }
  ]
}

Rules:
- Generate 8-12 distinct risks across all categories
- For ${city}, ${state}: include location-specific risks (weather, regulatory, market dynamics)
- ${starRating}-star ${propertyType}: include segment-specific risks
- Include at least: 2 market risks, 2 construction risks, 2 financial risks, 1 regulatory, 1 operational
- Use realistic risk assessments for Indian Tier-2/3 hotel markets
- Every risk must have a specific mitigation strategy
- Assign likelihood/impact based on realistic conditions`,
            messages: [{
              role: 'user',
              content: `Generate risk assessment for:

Property: ${propertyName} — ${roomCount} rooms, ${starRating}-star ${propertyType}
Location: ${city}, ${state}
Total Investment: ₹${investmentCr.toFixed(1)} Cr
Deal Type: ${dealType}
${demandCtx}
${scenarioCtx}

Financial: WACC ${(financials.wacc ?? 0.11) * 100}%, Debt interest ${(financials.debtInterestRate ?? 0.095) * 100}%
Construction budget: ₹${constructionBudgetCr.toFixed(1)} Cr

Consider risks related to: market demand (medical tourism, leisure, corporate), construction timeline and costs, regulatory approvals (Tamil Nadu), financial leverage, currency exposure, competitive landscape, weather/climate, and operational execution.

Generate comprehensive risk items. Respond with ONLY valid JSON.`,
            }],
          });

          const text = resp.content
            .filter(b => b.type === 'text')
            .map(b => 'text' in b ? (b as { text: string }).text : '')
            .join('');
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            let riskCount = 0;
            for (const risk of (parsed.risks ?? [])) {
              await createRisk(db, {
                dealId,
                title: risk.title,
                description: risk.description,
                category: risk.category ?? 'operational',
                likelihood: risk.likelihood ?? 'medium',
                impact: risk.impact ?? 'medium',
                mitigation: risk.mitigation,
                owner: risk.owner ?? 'CFO',
                createdBy: user.userId,
              });
              riskCount++;
            }

            results.risks = { count: riskCount };
          }
        } catch (err: any) {
          results.risks = { error: err.message };
          console.error('Risk generation failed:', err);
        }
      }

      // Audit entry
      await insertAuditEntry(db, {
        dealId,
        userId: user.userId,
        role: user.role,
        module: 'invest',
        action: 'deal.regenerate',
        entityType: 'deal',
        entityId: dealId,
        diff: { types, results },
      });

      return { ok: true, dealId, results };
    });

    if ((result as any)?.error === 'Deal not found') {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/deals/[id]/regenerate failed:', err);
    return NextResponse.json(
      { error: 'Regeneration failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
