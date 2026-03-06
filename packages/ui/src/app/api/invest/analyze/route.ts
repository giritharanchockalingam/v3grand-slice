/**
 * POST /api/invest/analyze — Naive Investor Workflow Orchestrator.
 *
 * 1. Creates a deal from simplified wizard inputs (uses POST /api/deals defaults)
 * 2. Runs ALL 6 CFO specialist agents in parallel against the new deal
 * 3. Synthesizes a final verdict (YES / NO / MAYBE) with confidence %
 * 4. Returns complete results for the results page
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getAgent } from '@/lib/agents/agent-registry';
import { getClaudeTools, executeTool } from '@/lib/agents/mcp-tool-bridge';
import { runAgentLoop } from '@/lib/agents/claude-client';
import type { ToolContext } from '@v3grand/mcp-server/agent-tools';
import type { AgentToolCall } from '@/lib/agents/types';

export const maxDuration = 60;

/** Wizard input from the naive investor UI */
interface InvestWizardInput {
  propertyName: string;
  city: string;
  state: string;
  starRating: number;
  roomCount: number;
  landAreaAcres: number;
  investmentAmountCr: number;
  dealType: 'new_build' | 'renovation' | 'acquisition';
  partnershipType: 'solo' | 'partnership';
  returnLevel: 'conservative' | 'moderate' | 'aggressive';
  riskComfort: 'low' | 'medium' | 'high';
  timelineYears: number;
}

/** Result from a single agent run */
interface AgentResult {
  agentId: string;
  agentName: string;
  agentIcon: string;
  reply: string;
  toolCalls: AgentToolCall[];
  durationMs: number;
  error?: string;
}

/** Final synthesized response */
interface InvestAnalysisResponse {
  dealId: string;
  dealName: string;
  verdict: 'YES' | 'NO' | 'MAYBE';
  confidence: number;
  summary: string;
  keyMetrics: {
    expectedReturn: string;
    riskLevel: string;
    marketOutlook: string;
    timelineConfidence: string;
  };
  agentResults: AgentResult[];
  warnings: string[];
}

/** Map user-friendly return level to financial target IRR */
function mapReturnLevel(level: string): number {
  switch (level) {
    case 'conservative': return 0.14;
    case 'aggressive': return 0.22;
    default: return 0.18; // moderate
  }
}

/** Map risk comfort to scenario adjustments */
function mapRiskScenarios(risk: string) {
  switch (risk) {
    case 'low':
      return {
        bear: { id: 'bear', name: 'bear', probability: 0.35, occupancyStabilized: 0.55, adrStabilized: 5500, ebitdaMargin: 0.25, mouRealizationPct: 0.55, phase2Trigger: false },
        base: { id: 'base', name: 'base', probability: 0.45, occupancyStabilized: 0.68, adrStabilized: 6800, ebitdaMargin: 0.32, mouRealizationPct: 0.70, phase2Trigger: true },
        bull: { id: 'bull', name: 'bull', probability: 0.20, occupancyStabilized: 0.78, adrStabilized: 7800, ebitdaMargin: 0.38, mouRealizationPct: 0.85, phase2Trigger: true },
      };
    case 'high':
      return {
        bear: { id: 'bear', name: 'bear', probability: 0.20, occupancyStabilized: 0.60, adrStabilized: 6000, ebitdaMargin: 0.30, mouRealizationPct: 0.65, phase2Trigger: false },
        base: { id: 'base', name: 'base', probability: 0.45, occupancyStabilized: 0.75, adrStabilized: 7500, ebitdaMargin: 0.38, mouRealizationPct: 0.80, phase2Trigger: true },
        bull: { id: 'bull', name: 'bull', probability: 0.35, occupancyStabilized: 0.88, adrStabilized: 9000, ebitdaMargin: 0.45, mouRealizationPct: 0.95, phase2Trigger: true },
      };
    default: // medium
      return {
        bear: { id: 'bear', name: 'bear', probability: 0.25, occupancyStabilized: 0.58, adrStabilized: 5800, ebitdaMargin: 0.28, mouRealizationPct: 0.60, phase2Trigger: false },
        base: { id: 'base', name: 'base', probability: 0.50, occupancyStabilized: 0.72, adrStabilized: 7000, ebitdaMargin: 0.35, mouRealizationPct: 0.75, phase2Trigger: true },
        bull: { id: 'bull', name: 'bull', probability: 0.25, occupancyStabilized: 0.82, adrStabilized: 8200, ebitdaMargin: 0.42, mouRealizationPct: 0.90, phase2Trigger: true },
      };
  }
}

/** Build deal creation payload from wizard inputs */
function buildDealPayload(input: InvestWizardInput, userEmail: string) {
  const targetIRR = mapReturnLevel(input.returnLevel);
  const scenarios = mapRiskScenarios(input.riskComfort);

  // Scale ADR based on star rating
  const adrMultiplier = input.starRating >= 5 ? 1.4 : input.starRating >= 4 ? 1.0 : 0.7;
  const adrBase = Math.round(5500 * adrMultiplier);
  const adrStabilized = Math.round(7000 * adrMultiplier);

  return {
    name: input.propertyName,
    assetClass: 'hotel',
    lifecyclePhase: input.dealType === 'new_build' ? 'pre-construction' : 'operational',
    captureContext: {
      dealType: input.dealType === 'new_build' ? 'Greenfield' : input.dealType === 'renovation' ? 'Brownfield' : 'Acquisition',
      dealSource: 'Self-sourced',
      strategicIntent: 'Growth',
      targetReturnBand: input.returnLevel === 'conservative' ? '12-16%' : input.returnLevel === 'aggressive' ? '20-25%' : '16-20%',
      investmentSizeBand: input.investmentAmountCr <= 50 ? '<50Cr' : input.investmentAmountCr <= 200 ? '50-200Cr' : '200Cr+',
    },
    property: {
      location: { city: input.city, state: input.state, country: 'India', latitude: 0, longitude: 0, distanceToAirportKm: 0 },
      landArea: { sqft: Math.round(input.landAreaAcres * 43560), acres: input.landAreaAcres },
      grossBUA: { phase1Sqft: Math.round(input.roomCount * 600), phase2Sqft: 0, totalSqft: Math.round(input.roomCount * 600) },
      keys: { phase1: input.roomCount, phase2: 0, total: input.roomCount },
      roomTypes: [
        { type: 'Deluxe', count: Math.round(input.roomCount * 0.5), avgRate: adrBase },
        { type: 'Premium', count: Math.round(input.roomCount * 0.3), avgRate: Math.round(adrBase * 1.3) },
        { type: 'Suite', count: Math.round(input.roomCount * 0.2), avgRate: Math.round(adrBase * 2.0) },
      ],
      amenities: ['Restaurant', 'Pool', 'Gym', 'Spa', 'Conference Hall'],
      starRating: input.starRating,
    },
    partnership: {
      structure: input.partnershipType === 'solo' ? 'sole' : 'jv',
      partners: [{ id: 'lead', name: userEmail, equityPct: 1, role: 'lead-investor', commitmentCr: input.investmentAmountCr }],
    },
    marketAssumptions: {
      segments: [
        { name: 'Domestic Business', pctMix: 0.35, adrPremium: 1.0, seasonality: [1,1,1,0.8,0.7,0.6,0.6,0.7,0.8,1,1.2,1.3] },
        { name: 'Domestic Leisure', pctMix: 0.30, adrPremium: 1.1, seasonality: [1.2,1.1,0.9,0.7,0.5,0.5,0.6,0.7,0.9,1.1,1.3,1.4] },
        { name: 'Corporate Events', pctMix: 0.20, adrPremium: 0.9, seasonality: [1,1,1,1,0.8,0.6,0.6,0.8,1,1,1.2,1.2] },
        { name: 'International', pctMix: 0.15, adrPremium: 1.4, seasonality: [1.3,1.2,1,0.7,0.5,0.4,0.4,0.6,0.8,1.1,1.3,1.5] },
      ],
      occupancyRamp: [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.72, 0.72, 0.72, 0.72],
      adrBase,
      adrStabilized,
      adrGrowthRate: 0.05,
      revenueMix: { rooms: 0.55, fb: 0.25, banquet: 0.12, other: 0.08 },
      seasonality: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, multiplier: 1.0 })),
      compSet: [],
    },
    financialAssumptions: {
      wacc: 0.12, riskFreeRate: 0.065,
      equityRatio: input.partnershipType === 'solo' ? 0.5 : 0.4,
      debtRatio: input.partnershipType === 'solo' ? 0.5 : 0.6,
      debtInterestRate: 0.095, debtTenorYears: 15,
      exitCapRate: 0.08, exitMultiple: 8,
      taxRate: 0.25, inflationRate: 0.05,
      managementFeePct: 0.03, incentiveFeePct: 0.10,
      ffAndEReservePct: 0.04, workingCapitalDays: 30,
      targetIRR,
      targetEquityMultiple: 2.5,
      targetDSCR: 1.2,
    },
    capexPlan: {
      phase1: { totalBudgetCr: input.investmentAmountCr * 0.85, items: [] },
      phase2: { totalBudgetCr: 0, items: [] },
      contingencyPct: 0.10,
    },
    opexModel: { departments: [], undistributed: [], fixedCharges: [] },
    scenarios,
  };
}

/** Run a single agent and return its result */
async function runSingleAgent(
  agentId: string,
  message: string,
  toolContext: ToolContext,
): Promise<AgentResult> {
  const startTime = Date.now();
  const agent = getAgent(agentId);
  if (!agent) {
    return {
      agentId,
      agentName: agentId,
      agentIcon: '?',
      reply: `Agent ${agentId} not found`,
      toolCalls: [],
      durationMs: 0,
      error: 'Agent not found',
    };
  }

  try {
    const tools = getClaudeTools(agent.toolNames);
    const systemPrompt = `${agent.systemPrompt}\n\n${agent.formatInstructions}`;

    const result = await runAgentLoop({
      systemPrompt,
      tools,
      messages: [],
      userMessage: message,
      executeTool: (name, input) => executeTool(name, input, toolContext),
    });

    return {
      agentId: agent.id,
      agentName: agent.title,
      agentIcon: agent.icon,
      reply: result.reply,
      toolCalls: result.toolCalls,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      agentId: agent.id,
      agentName: agent.title,
      agentIcon: agent.icon,
      reply: `Analysis could not be completed: ${err instanceof Error ? err.message : String(err)}`,
      toolCalls: [],
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Use Claude to synthesize all agent results into a final verdict */
async function synthesizeVerdict(
  dealName: string,
  input: InvestWizardInput,
  agentResults: AgentResult[],
): Promise<{ verdict: 'YES' | 'NO' | 'MAYBE'; confidence: number; summary: string; keyMetrics: InvestAnalysisResponse['keyMetrics']; warnings: string[] }> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const agentSummaries = agentResults
    .map((r) => `### ${r.agentIcon} ${r.agentName}\n${r.error ? `ERROR: ${r.error}` : r.reply}`)
    .join('\n\n---\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are an investment synthesis engine. You receive analysis from 6 specialist CFO agents and must produce a final verdict for a NAIVE INVESTOR who has no financial knowledge.

CRITICAL: You must respond in EXACTLY this JSON format and nothing else:
{
  "verdict": "YES" | "NO" | "MAYBE",
  "confidence": <number 0-100>,
  "summary": "<2-3 sentence plain-English summary a non-expert would understand>",
  "keyMetrics": {
    "expectedReturn": "<plain English, e.g. 'Good — about 18% yearly profit on your money'>",
    "riskLevel": "<plain English, e.g. 'Medium — some risks but manageable'>",
    "marketOutlook": "<plain English, e.g. 'Strong — this city has growing tourism demand'>",
    "timelineConfidence": "<plain English, e.g. 'On track — construction budget looks reasonable'>"
  },
  "warnings": ["<plain English warning 1>", "<plain English warning 2>"]
}

Rules:
- YES means: The investment looks good overall with manageable risks
- NO means: Serious concerns that outweigh the potential returns
- MAYBE means: Promising but needs more investigation or has conditional factors
- Confidence is 0-100 based on how strong the evidence is
- ALL language must be simple enough for someone with zero financial knowledge
- Never use jargon (IRR, NPV, DSCR, WACC, etc.) — translate everything to plain English
- Warnings should highlight real concerns the investor should know about`,
    messages: [{
      role: 'user',
      content: `Here is the investment being analyzed:

**Property:** ${dealName}
**Location:** ${input.city}, ${input.state}
**Investment:** ₹${input.investmentAmountCr} Crore
**Type:** ${input.dealType === 'new_build' ? 'New construction' : input.dealType === 'renovation' ? 'Renovation' : 'Buying existing property'}
**Hotel:** ${input.starRating}-star, ${input.roomCount} rooms
**Investor wants:** ${input.returnLevel} returns, ${input.riskComfort} risk tolerance

Here are the analyses from our 6 specialist agents:

${agentSummaries}

Synthesize all of this into a single verdict. Respond with ONLY valid JSON.`,
    }],
  });

  try {
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => 'text' in b ? (b as { text: string }).text : '')
      .join('');

    // Extract JSON from the response (handle possible markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in synthesis response');

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict || 'MAYBE',
      confidence: parsed.confidence || 50,
      summary: parsed.summary || 'Analysis complete. Please review the detailed findings below.',
      keyMetrics: parsed.keyMetrics || {
        expectedReturn: 'See detailed analysis below',
        riskLevel: 'See detailed analysis below',
        marketOutlook: 'See detailed analysis below',
        timelineConfidence: 'See detailed analysis below',
      },
      warnings: parsed.warnings || [],
    };
  } catch {
    return {
      verdict: 'MAYBE',
      confidence: 50,
      summary: 'Our team completed their analysis. Review the detailed findings from each specialist below to make your decision.',
      keyMetrics: {
        expectedReturn: 'See detailed agent analysis below',
        riskLevel: 'See detailed agent analysis below',
        marketOutlook: 'See detailed agent analysis below',
        timelineConfidence: 'See detailed agent analysis below',
      },
      warnings: ['The automatic summary could not be generated — please review each agent\'s analysis directly.'],
    };
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const user = await getAuthUser(request);

    const input = (await request.json()) as InvestWizardInput;

    // Validate required fields
    if (!input.propertyName || !input.city || !input.state) {
      return NextResponse.json({ error: 'Property name, city, and state are required' }, { status: 400 });
    }

    const userEmail = user?.email ?? user?.userId ?? 'investor';
    const userId = user?.userId;

    // Step 1: Create the deal
    const { createDeal, grantDealAccess, insertAuditEntry } = await import('@v3grand/db');
    const dealPayload = buildDealPayload(input, userEmail);
    const deal = await createDeal(db, dealPayload);

    if (userId) {
      await grantDealAccess(db, { userId, dealId: deal.id, role: user?.role ?? 'lead_investor' });
    }
    await insertAuditEntry(db, {
      dealId: deal.id,
      userId: userId ?? 'anonymous',
      role: user?.role ?? 'lead_investor',
      module: 'invest',
      action: 'invest.wizard.created',
      entityType: 'deal',
      entityId: deal.id,
      diff: { source: 'naive-investor-wizard', city: input.city, investmentCr: input.investmentAmountCr },
    });

    // Step 2: Run all 6 agents in parallel
    const toolContext: ToolContext = {
      userId: userId,
      role: user?.role ?? 'lead_investor',
    };

    const dealName = input.propertyName;
    const city = input.city;

    const agentPrompts: Array<{ agentId: string; message: string }> = [
      {
        agentId: 'market-analyst',
        message: `Analyze the market conditions for a ${input.starRating}-star hotel investment in ${city}, ${input.state}. What are the macro indicators, city-level demand signals, and overall market health? The deal is called "${dealName}".`,
      },
      {
        agentId: 'deal-underwriter',
        message: `Provide a full IC-ready analysis of the deal "${dealName}". Score all underwriting factors, run Monte Carlo simulation, and assess deal readiness. This is a ${input.starRating}-star, ${input.roomCount}-room hotel in ${city}.`,
      },
      {
        agentId: 'construction-monitor',
        message: `Analyze the construction budget and timeline for "${dealName}". This is a ${input.dealType === 'new_build' ? 'new construction' : input.dealType} project with ₹${input.investmentAmountCr}Cr investment. Check for budget variances and milestone risks.`,
      },
      {
        agentId: 'compliance-auditor',
        message: `Run a full compliance and audit check for "${dealName}". Verify hash chain integrity, SOC2 controls, audit trail completeness, and validation model status.`,
      },
      {
        agentId: 'portfolio-risk-officer',
        message: `Assess the portfolio risk impact of adding "${dealName}" — a ${input.starRating}-star hotel in ${city} with ₹${input.investmentAmountCr}Cr investment. Check risk concentration, run stress tests, and flag any concerns.`,
      },
      {
        agentId: 'capital-allocator',
        message: `Evaluate the capital allocation for "${dealName}" — ₹${input.investmentAmountCr}Cr into a ${input.starRating}-star hotel in ${city}. Compare risk-adjusted returns against portfolio benchmarks and recommend whether this deployment makes sense.`,
      },
    ];

    const agentResults = await Promise.all(
      agentPrompts.map(({ agentId, message }) =>
        runSingleAgent(agentId, message, toolContext)
      )
    );

    // Step 3: Synthesize verdict
    const synthesis = await synthesizeVerdict(dealName, input, agentResults);

    const response: InvestAnalysisResponse = {
      dealId: deal.id,
      dealName,
      verdict: synthesis.verdict,
      confidence: synthesis.confidence,
      summary: synthesis.summary,
      keyMetrics: synthesis.keyMetrics,
      agentResults,
      warnings: synthesis.warnings,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('POST /api/invest/analyze failed:', err);
    return NextResponse.json(
      { error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
