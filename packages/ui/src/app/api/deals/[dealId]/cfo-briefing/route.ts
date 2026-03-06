/**
 * POST /api/deals/[dealId]/cfo-briefing — AI-Powered CFO Investment Committee Briefing.
 *
 * Uses Claude to synthesize ALL available deal data into a genuine CFO-caliber
 * Investment Committee presentation narrative. Unlike the old template approach,
 * this generates a dynamic, intelligent briefing that:
 *   1. Reads all engine results (underwriter, montecarlo, factor, budget, scurve, decision)
 *   2. Incorporates the 16-agent analyses from the invest wizard (if available)
 *   3. Synthesizes a coherent IC narrative with real insights, not templates
 *   4. Adapts tone to the actual findings (bullish when warranted, cautious when needed)
 */

import { NextResponse } from 'next/server';
import { withRLS } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import {
  getDealById, getLatestEngineResult, getLatestEngineResultByScenario,
  getLatestRecommendation,
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

    // Accept optional agent results from the client (from invest wizard sessionStorage)
    const body = await request.json().catch(() => ({}));
    const agentResults: Array<{ agentName: string; reply: string; error?: string }> = body.agentResults ?? [];
    const investVerdict = body.investVerdict ?? null;
    const investSummary = body.investSummary ?? null;
    const investKeyMetrics = body.investKeyMetrics ?? null;
    const investWarnings: string[] = body.investWarnings ?? [];

    // Fetch all deal data with RLS
    const data = await withRLS(user.userId, user.role, async (db) => {
      const dealRow = await getDealById(db, dealId);
      if (!dealRow) return null;

      const [latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestDecisionResult] = await Promise.all([
        getLatestEngineResultByScenario(db, dealId, 'underwriter', 'base'),
        getLatestRecommendation(db, dealId),
        getLatestEngineResult(db, dealId, 'montecarlo'),
        getLatestEngineResult(db, dealId, 'factor'),
        getLatestEngineResult(db, dealId, 'budget'),
        getLatestEngineResult(db, dealId, 'decision'),
      ]);

      return { dealRow, latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestDecisionResult };
    });

    if (!data) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });

    const { dealRow, latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestDecisionResult } = data;

    // Build comprehensive context for Claude
    const dealContext = buildDealContext(dealRow, latestUW, latestRec, latestMCResult, latestFactorResult, latestBudgetResult, latestDecisionResult);
    const agentContext = buildAgentContext(agentResults);
    const investWizardContext = investVerdict ? buildInvestWizardContext(investVerdict, investSummary, investKeyMetrics, investWarnings) : '';

    // Generate CFO briefing via Claude
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: CFO_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Generate the CFO Investment Committee briefing for the following deal.

${dealContext}

${agentContext}

${investWizardContext}

Remember: You ARE the CFO presenting to the Investment Committee. Speak in first person. This will be read aloud via text-to-speech, so write for the ear, not the eye. No bullet points, no markdown, no numbers in parentheses. Write flowing, authoritative prose that a CFO would actually speak in a boardroom. Every claim must be grounded in the data provided above.`,
      }],
    });

    const narrative = response.content
      .filter((b) => b.type === 'text')
      .map((b) => 'text' in b ? (b as { text: string }).text : '')
      .join('');

    return NextResponse.json({ narrative, dealId, dealName: dealRow.name });
  } catch (err) {
    console.error('POST /api/deals/[id]/cfo-briefing failed:', err);
    return NextResponse.json(
      { error: 'Failed to generate CFO briefing', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// ─── CFO System Prompt ─────────────────────────────────────────────
const CFO_SYSTEM_PROMPT = `You are the Chief Financial Officer of V3 Grand Investment OS, presenting to the Investment Committee (IC). You are speaking live in a boardroom. Your audience is sophisticated — partners, LPs, and co-investors who understand hotel real estate investing deeply.

VOICE AND TONE:
- You speak with authority, precision, and measured confidence
- You use first person ("I", "my assessment", "our position")
- You address the room directly ("Members of the committee", "I want the committee to note")
- You never hedge unnecessarily but you flag genuine concerns with conviction
- You use financial terminology naturally but always explain the "so what" — why a number matters
- You reference specific data points from the analysis, never vague generalities
- You connect dots across different analyses — if the market analyst flagged tourism demand and the factor engine confirmed it, SAY that

STRUCTURE (adapt based on available data):
1. Opening — Set the room. Name the deal, location, asset class, investment size. One sentence.
2. Investment Thesis — What is the verdict? Why? Be specific. If agents found something, cite it.
3. The Numbers — IRR, NPV, Monte Carlo distribution, factor scores. Interpret them, don't just list them.
4. Market Intelligence — What did the market analysis find? Tourism demand? Medical corridor? Competition?
5. Risk Assessment — What are the real risks? Not generic ones. Specific risks from the analysis.
6. Legal & Compliance — Any regulatory concerns? Tax implications? Licensing issues?
7. Operational Strategy — Brand affiliation impact? Revenue optimization opportunities?
8. Partner & Capital Structure — How is the deal funded? LP implications?
9. Construction & Execution — Budget status, timeline, execution risk
10. Exit Strategy — How do we get out? When? At what multiple?
11. Closing — Your personal recommendation to the IC. Be direct.

CRITICAL RULES:
- This is for text-to-speech. Write for the ear. No bullet points, no markdown formatting, no asterisks.
- Write numbers as words when short ("eighteen percent" not "18%"), but use digits for precise figures ("IRR of 28.4 percent")
- Do NOT use abbreviations without expanding them at first use
- Do NOT include section headers or labels — just flow naturally from one topic to the next
- Every statement must be grounded in the actual data provided. If data is missing, say so honestly.
- If agent analyses are provided, synthesize their specific findings — don't ignore them
- The briefing should be 3-5 minutes when read aloud (roughly 500-800 words)
- End with "I will take questions." — this is IC protocol`;

// ─── Context Builders ──────────────────────────────────────────────
function buildDealContext(dealRow: any, uw: any, rec: any, mc: any, factor: any, budget: any, decision: any): string {
  const parts: string[] = ['=== DEAL DATA ==='];

  // Core deal info
  parts.push(`Deal Name: ${dealRow.name}`);
  parts.push(`Asset Class: ${dealRow.assetClass}`);
  parts.push(`Status: ${dealRow.status}, Phase: ${dealRow.lifecyclePhase}, Month: ${dealRow.currentMonth}`);

  // Property
  const prop = dealRow.property as any;
  if (prop) {
    parts.push(`Location: ${prop.location?.city}, ${prop.location?.state}, ${prop.location?.country}`);
    parts.push(`Star Rating: ${prop.starRating}-star`);
    parts.push(`Keys: ${prop.keys?.total} rooms`);
    parts.push(`Land: ${prop.landArea?.acres} acres`);
    parts.push(`Airport: ${prop.location?.distanceToAirportKm}km from ${prop.location?.nearestAirport}`);
    if (prop.amenities?.length) parts.push(`Amenities: ${prop.amenities.join(', ')}`);
  }

  // Partnership
  const ptr = dealRow.partnership as any;
  if (ptr) {
    parts.push(`Partnership: ${ptr.structure}`);
    if (ptr.partners?.length) {
      for (const p of ptr.partners) {
        parts.push(`  Partner: ${p.name} — ${Math.round(p.equityPct * 100)}% equity, ₹${p.commitmentCr}Cr committed, role: ${p.role}`);
      }
    }
  }

  // Financial Assumptions
  const fin = dealRow.financialAssumptions as any;
  if (fin) {
    parts.push(`Financial Assumptions: WACC=${(fin.wacc*100).toFixed(1)}%, Target IRR=${(fin.targetIRR*100).toFixed(1)}%, Equity Ratio=${(fin.equityRatio*100)}%, Debt Rate=${(fin.debtInterestRate*100).toFixed(1)}%, Debt Tenor=${fin.debtTenorYears}yr, Exit Cap Rate=${(fin.exitCapRate*100).toFixed(1)}%`);
  }

  // Market Assumptions
  const mkt = dealRow.marketAssumptions as any;
  if (mkt) {
    parts.push(`Market: Base ADR=₹${mkt.adrBase}, Stabilized ADR=₹${mkt.adrStabilized}, Growth=${(mkt.adrGrowthRate*100).toFixed(1)}%/yr`);
    if (mkt.occupancyRamp?.length) {
      parts.push(`Occupancy Ramp: ${mkt.occupancyRamp.map((o: number) => `${Math.round(o*100)}%`).join(' → ')}`);
    }
    if (mkt.segments?.length) {
      parts.push(`Demand Segments: ${mkt.segments.map((s: any) => `${s.name} ${Math.round(s.pctMix*100)}%`).join(', ')}`);
    }
    if (mkt.revenueMix) {
      const rm = mkt.revenueMix;
      parts.push(`Revenue Mix: Rooms ${Math.round(rm.rooms*100)}%, F&B ${Math.round(rm.fb*100)}%, Banquet ${Math.round(rm.banquet*100)}%, Other ${Math.round(rm.other*100)}%`);
    }
  }

  // Market Context (from invest wizard)
  const ctx = (dealRow as any).marketContext;
  if (ctx) {
    parts.push(`Market Context: ${ctx.propertyType}, ${ctx.cityTier}, ${ctx.marketSegment} market`);
    if (ctx.brandStrategy) parts.push(`Brand Strategy: ${ctx.brandStrategy}${ctx.preferredBrand ? ` (${ctx.preferredBrand})` : ''}`);
    if (ctx.hasAnchorPartnership) parts.push(`Anchor Partnership: ${ctx.anchorType}, ${ctx.anchorCommittedNightsPerMonth} room-nights/month committed`);
    if (ctx.demandSegmentation) {
      const ds = ctx.demandSegmentation;
      parts.push(`Demand: Corporate ${ds.corporate}%, Medical ${ds.medical}%, Leisure ${ds.leisure}%, MICE ${ds.mice}%`);
    }
  }

  // CapEx
  const capex = dealRow.capexPlan as any;
  if (capex?.phase1) {
    parts.push(`CapEx: Phase 1 Budget ₹${capex.phase1.totalBudgetCr}Cr, Contingency ${(capex.contingencyPct*100).toFixed(0)}%`);
  }

  // Underwriter Results
  if (uw) {
    const o = uw.output as any;
    parts.push(`\n=== UNDERWRITER ENGINE (Base Case) ===`);
    parts.push(`IRR: ${(o.irr*100).toFixed(1)}%, NPV: ₹${(o.npv/1e7).toFixed(1)}Cr, Equity Multiple: ${o.equityMultiple?.toFixed(2)}x`);
    parts.push(`Payback: Year ${o.paybackYear}, Avg DSCR: ${o.avgDSCR?.toFixed(2)}x`);
    parts.push(`Total Investment: ₹${(o.totalInvestment/1e7).toFixed(1)}Cr, Exit Value: ₹${(o.exitValue/1e7).toFixed(1)}Cr`);
  }

  // Monte Carlo Results
  if (mc) {
    const o = mc.output as any;
    parts.push(`\n=== MONTE CARLO (5,000 simulations) ===`);
    const pctls = o.percentiles ?? {};
    parts.push(`IRR Distribution: P10=${((pctls.p10 ?? o.p10Irr)*100).toFixed(1)}%, P50=${((pctls.p50 ?? o.p50Irr)*100).toFixed(1)}%, P90=${((pctls.p90 ?? o.p90Irr)*100).toFixed(1)}%`);
    parts.push(`P(NPV < 0): ${((o.probNpvNegative ?? o.probNpvNeg)*100).toFixed(1)}%`);
    parts.push(`P(IRR < WACC): ${((o.probIrrBelowWacc)*100).toFixed(1)}%`);
  }

  // Factor Results
  if (factor) {
    const o = factor.output as any;
    parts.push(`\n=== FACTOR ENGINE ===`);
    parts.push(`Composite Score: ${o.compositeScore?.toFixed(1)}/5 (${o.compositeScore >= 4 ? 'Strong' : o.compositeScore >= 3 ? 'Adequate' : 'Below grade'})`);
    if (o.domainScores) {
      for (const [domain, score] of Object.entries(o.domainScores as Record<string, number>)) {
        parts.push(`  ${domain}: ${(score as number).toFixed(1)}/5`);
      }
    }
    if (o.factors?.length) {
      for (const f of o.factors.slice(0, 8)) {
        parts.push(`  Factor: ${f.name} (${f.domain}) — Score ${f.score.toFixed(1)}/5 — ${f.rationale}`);
      }
    }
    if (o.impliedCapRate) parts.push(`Implied Cap Rate: ${(o.impliedCapRate*100).toFixed(1)}%`);
    if (o.requiredReturn) parts.push(`Required Return (WACC from factors): ${(o.requiredReturn*100).toFixed(1)}%`);
  }

  // Budget Results
  if (budget) {
    const o = budget.output as any;
    parts.push(`\n=== BUDGET ENGINE ===`);
    parts.push(`Status: ${o.overallStatus}`);
    if (o.varianceToCurrent) parts.push(`Variance: ${(o.varianceToCurrent*100).toFixed(1)}%`);
    if (o.alerts?.length) parts.push(`Alerts: ${o.alerts.join('; ')}`);
  }

  // Decision Engine
  if (decision) {
    const o = decision.output as any;
    parts.push(`\n=== DECISION ENGINE ===`);
    if (o.narrative) parts.push(`Narrative: ${o.narrative}`);
    if (o.topDrivers?.length) parts.push(`Top Drivers: ${o.topDrivers.join('; ')}`);
    if (o.topRisks?.length) parts.push(`Top Risks: ${o.topRisks.join('; ')}`);
    if (o.flipConditions?.length) parts.push(`Flip Conditions: ${o.flipConditions.join('; ')}`);
  }

  // Recommendation
  if (rec) {
    parts.push(`\n=== LATEST RECOMMENDATION ===`);
    parts.push(`Verdict: ${rec.verdict}, Confidence: ${rec.confidence}%`);
    if (rec.explanation) parts.push(`Explanation: ${rec.explanation}`);
  }

  return parts.join('\n');
}

function buildAgentContext(agentResults: Array<{ agentName: string; reply: string; error?: string }>): string {
  if (!agentResults.length) return '';

  const parts: string[] = ['\n=== 16-AGENT ANALYSIS RESULTS ==='];
  parts.push('The following specialist agents analyzed this deal:');

  for (const agent of agentResults) {
    if (agent.error) {
      parts.push(`\n[${agent.agentName}]: FAILED — ${agent.error}`);
    } else {
      // Truncate very long replies to keep context manageable
      const reply = agent.reply.length > 1500 ? agent.reply.substring(0, 1500) + '...' : agent.reply;
      parts.push(`\n[${agent.agentName}]:\n${reply}`);
    }
  }

  return parts.join('\n');
}

function buildInvestWizardContext(verdict: string, summary: string, keyMetrics: any, warnings: string[]): string {
  const parts: string[] = ['\n=== INVEST WIZARD VERDICT ==='];
  parts.push(`Verdict: ${verdict}`);
  if (summary) parts.push(`Summary: ${summary}`);
  if (keyMetrics) {
    parts.push(`Expected Return: ${keyMetrics.expectedReturn}`);
    parts.push(`Risk Level: ${keyMetrics.riskLevel}`);
    parts.push(`Market Outlook: ${keyMetrics.marketOutlook}`);
    parts.push(`Timeline Confidence: ${keyMetrics.timelineConfidence}`);
  }
  if (warnings.length) {
    parts.push(`Warnings: ${warnings.join('; ')}`);
  }
  return parts.join('\n');
}
