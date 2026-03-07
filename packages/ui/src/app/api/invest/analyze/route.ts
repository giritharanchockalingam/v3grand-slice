/**
 * POST /api/invest/analyze — Naive Investor Workflow Orchestrator.
 *
 * 1. Creates a deal from simplified wizard inputs (uses POST /api/deals defaults)
 * 2. Runs ALL 16 specialist agents in parallel against the new deal (two batches)
 * 3. Synthesizes a final verdict (YES / NO / MAYBE) with confidence %
 * 4. Returns complete results for the results page
 */

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/server/db';
import { getAuthUser } from '@/lib/server/auth';
import { getAgent } from '@/lib/agents/agent-registry';
import { getClaudeTools, executeTool } from '@/lib/agents/mcp-tool-bridge';
import { runAgentLoop } from '@/lib/agents/claude-client';
import { investAnalyzeSchema } from '@/lib/server/schemas';
import type { ToolContext } from '@v3grand/mcp-server/agent-tools';
import type { AgentToolCall } from '@/lib/agents/types';

export const maxDuration = 300;

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
  // Location (Google Maps)
  propertyAddress: string;
  latitude: number;
  longitude: number;
  distanceToAirportKm: number;
  nearestAirport: string;
  // Property Classification
  propertyType: 'luxury_resort' | 'business_hotel' | 'budget_hotel' | 'heritage' | 'boutique' | 'mixed_use';
  propertyAge?: number;
  constructionTimelineMonths?: number;
  currentOccupancyPct?: number;
  // Market Context
  cityTier: 'tier1' | 'tier2' | 'tier3';
  marketSegment: 'tourist' | 'business' | 'pilgrimage' | 'medical' | 'mixed';
  competingHotelsNearby?: number;
  // Financial
  existingDebtCr?: number;
  knownRevparInr?: number;
  // Demand Segmentation
  demandCorporatePct: number;
  demandMedicalPct: number;
  demandLeisurePct: number;
  demandMicePct: number;
  // Anchor Partnerships
  hasAnchorPartnership: boolean;
  anchorType?: 'medical' | 'corporate' | 'government' | 'mixed';
  anchorCommittedNightsPerMonth?: number;
  // Brand Affiliation
  brandStrategy: 'independent' | 'franchise' | 'management_contract' | 'undecided';
  preferredBrand?: string;
  // Partner Equity
  leadInvestorPct?: number;
  partner2Pct?: number;
  partner3Pct?: number;
}

/** Data provenance for an agent's analysis */
interface DataProvenance {
  externalApis: string[];       // e.g. ['RBI DBIE API', 'FRED', 'Brave Search']
  internalTools: string[];      // e.g. ['get_deal_dashboard', 'run_montecarlo']
  webSearches: number;          // count of web_search / search_hotel_market / search_regulatory calls
  dataQuality: 'verified-external' | 'internal-calculation' | 'reference-benchmark' | 'ai-estimate';
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
  provenance?: DataProvenance;
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

  // Scale ADR based on star rating and property type
  const starMultiplier = input.starRating >= 7 ? 2.0 : input.starRating >= 5 ? 1.4 : input.starRating >= 4 ? 1.0 : 0.7;
  const typeMultiplier = input.propertyType === 'luxury_resort' ? 1.3 : input.propertyType === 'heritage' ? 1.2 : input.propertyType === 'boutique' ? 1.1 : input.propertyType === 'budget_hotel' ? 0.6 : 1.0;
  const adrBase = Math.round(5500 * starMultiplier * typeMultiplier);
  const adrStabilized = input.knownRevparInr
    ? Math.round(input.knownRevparInr / 0.68) // Derive ADR from RevPAR / avg occupancy
    : Math.round(7000 * starMultiplier * typeMultiplier);

  // Occupancy ramp — acquisitions start at current occupancy, new builds ramp from 30%
  const baseOccupancy = input.currentOccupancyPct ? input.currentOccupancyPct / 100 : 0.68;
  const occupancyRamp = input.dealType === 'acquisition' || input.dealType === 'renovation'
    ? [baseOccupancy, Math.min(baseOccupancy + 0.03, 0.85), Math.min(baseOccupancy + 0.05, 0.85), Math.min(baseOccupancy + 0.06, 0.85), Math.min(baseOccupancy + 0.07, 0.85), Math.min(baseOccupancy + 0.07, 0.85), Math.min(baseOccupancy + 0.07, 0.85), Math.min(baseOccupancy + 0.07, 0.85), Math.min(baseOccupancy + 0.07, 0.85), Math.min(baseOccupancy + 0.07, 0.85)]
    : [0.3, 0.45, 0.55, 0.62, 0.68, 0.72, 0.72, 0.72, 0.72, 0.72];

  // Amenities based on property type
  const baseAmenities = ['Restaurant', 'Gym'];
  const typeAmenities: Record<string, string[]> = {
    luxury_resort: ['Pool', 'Spa', 'Private Beach', 'Fine Dining', 'Conference Hall', 'Helipad'],
    business_hotel: ['Conference Hall', 'Business Center', 'Pool', 'Spa'],
    budget_hotel: ['Cafe', 'Parking'],
    heritage: ['Heritage Walk', 'Spa', 'Pool', 'Cultural Center'],
    boutique: ['Pool', 'Spa', 'Rooftop Lounge'],
    mixed_use: ['Pool', 'Spa', 'Conference Hall', 'Retail'],
  };

  // Competitive set if info available
  const compSet = input.competingHotelsNearby ? [{
    name: `Local Market (~${input.competingHotelsNearby} similar hotels)`,
    keys: Math.round(input.roomCount * 1.2),
    adr: adrStabilized,
    occ: baseOccupancy,
    revpar: Math.round(adrStabilized * baseOccupancy),
  }] : [];

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
      location: {
        city: input.city,
        state: input.state,
        country: 'India',
        latitude: input.latitude,
        longitude: input.longitude,
        distanceToAirportKm: input.distanceToAirportKm,
        address: input.propertyAddress,
        nearestAirport: input.nearestAirport,
      },
      landArea: { sqft: Math.round(input.landAreaAcres * 43560), acres: input.landAreaAcres },
      grossBUA: { phase1Sqft: Math.round(input.roomCount * 600), phase2Sqft: 0, totalSqft: Math.round(input.roomCount * 600) },
      keys: { phase1: input.roomCount, phase2: 0, total: input.roomCount },
      roomTypes: [
        { type: 'Deluxe', count: Math.round(input.roomCount * 0.5), avgRate: adrBase },
        { type: 'Premium', count: Math.round(input.roomCount * 0.3), avgRate: Math.round(adrBase * 1.3) },
        { type: 'Suite', count: Math.round(input.roomCount * 0.2), avgRate: Math.round(adrBase * 2.0) },
      ],
      amenities: [...baseAmenities, ...(typeAmenities[input.propertyType] || [])],
      starRating: input.starRating,
    },
    marketContext: {
      propertyType: input.propertyType,
      cityTier: input.cityTier,
      marketSegment: input.marketSegment,
      propertyAge: input.propertyAge,
      constructionTimelineMonths: input.constructionTimelineMonths,
      currentOccupancy: input.currentOccupancyPct,
      competingHotels: input.competingHotelsNearby,
      nearestAirport: input.nearestAirport,
      distanceToAirportKm: input.distanceToAirportKm,
      knownRevpar: input.knownRevparInr,
      demandSegmentation: {
        corporate: input.demandCorporatePct,
        medical: input.demandMedicalPct,
        leisure: input.demandLeisurePct,
        mice: input.demandMicePct,
      },
      brandStrategy: input.brandStrategy,
      preferredBrand: input.preferredBrand,
      hasAnchorPartnership: input.hasAnchorPartnership,
      anchorType: input.anchorType,
      anchorCommittedNightsPerMonth: input.anchorCommittedNightsPerMonth,
    },
    partnership: {
      structure: input.partnershipType === 'solo' ? 'sole' : 'jv',
      partners: input.partnershipType === 'solo'
        ? [{ id: 'lead', name: userEmail, equityPct: 1, role: 'lead-investor', commitmentCr: input.investmentAmountCr }]
        : [
            { id: 'lead', name: userEmail, equityPct: (input.leadInvestorPct ?? 50) / 100, role: 'lead-investor', commitmentCr: Math.round(input.investmentAmountCr * (input.leadInvestorPct ?? 50) / 100) },
            ...(input.partner2Pct && input.partner2Pct > 0 ? [{ id: 'partner2', name: 'Partner 2', equityPct: input.partner2Pct / 100, role: 'co-investor' as const, commitmentCr: Math.round(input.investmentAmountCr * input.partner2Pct / 100) }] : []),
            ...(input.partner3Pct && input.partner3Pct > 0 ? [{ id: 'partner3', name: 'Partner 3', equityPct: input.partner3Pct / 100, role: 'co-investor' as const, commitmentCr: Math.round(input.investmentAmountCr * input.partner3Pct / 100) }] : []),
          ],
    },
    // Anchor partnership context for agents
    anchorPartnership: input.hasAnchorPartnership ? {
      type: input.anchorType,
      committedNightsPerMonth: input.anchorCommittedNightsPerMonth || 0,
      // Guaranteed revenue from anchors (as % of total room-nights)
      guaranteedOccupancyPct: input.anchorCommittedNightsPerMonth
        ? Math.round((input.anchorCommittedNightsPerMonth / (input.roomCount * 30)) * 100)
        : 0,
    } : null,
    // Brand affiliation strategy
    brandAffiliation: {
      strategy: input.brandStrategy,
      preferredBrand: input.preferredBrand,
      // Fee estimates for agents to validate
      estimatedFeeLeakagePct: input.brandStrategy === 'franchise' ? 0.10 : input.brandStrategy === 'management_contract' ? 0.13 : 0,
    },
    marketAssumptions: {
      segments: [
        { name: 'Corporate', pctMix: input.demandCorporatePct / 100, adrPremium: 1.0, seasonality: [1,1,1,0.8,0.7,0.6,0.6,0.7,0.8,1,1.2,1.3] },
        { name: 'Medical Tourism', pctMix: input.demandMedicalPct / 100, adrPremium: 0.9, seasonality: [1,1,1,1,1,0.9,0.9,1,1,1,1,1] },
        { name: 'Leisure', pctMix: input.demandLeisurePct / 100, adrPremium: 1.1, seasonality: [1.2,1.1,0.9,0.7,0.5,0.5,0.6,0.7,0.9,1.1,1.3,1.4] },
        { name: 'MICE / Events', pctMix: input.demandMicePct / 100, adrPremium: 0.85, seasonality: [1,1,1,1,0.8,0.6,0.6,0.8,1,1,1.2,1.2] },
      ],
      occupancyRamp,
      adrBase,
      adrStabilized,
      adrGrowthRate: 0.05,
      revenueMix: { rooms: 0.55, fb: 0.25, banquet: 0.12, other: 0.08 },
      seasonality: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, multiplier: 1.0 })),
      compSet,
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
      existingDebtCr: input.existingDebtCr || 0,
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

/** Per-agent timeout in milliseconds (120 seconds) */
const AGENT_TIMEOUT_MS = 120_000;

/** Run a single agent with timeout protection */
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

    // Race agent execution against a timeout
    const agentPromise = runAgentLoop({
      systemPrompt,
      tools,
      messages: [],
      userMessage: message,
      executeTool: (name, input) => executeTool(name, input, toolContext),
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Agent ${agent.name} timed out after ${AGENT_TIMEOUT_MS / 1000}s`)), AGENT_TIMEOUT_MS)
    );

    const result = await Promise.race([agentPromise, timeoutPromise]);

    // Compute data provenance from tool calls
    const provenance = computeProvenance(result.toolCalls);

    return {
      agentId: agent.id,
      agentName: agent.title,
      agentIcon: agent.icon,
      reply: result.reply,
      toolCalls: result.toolCalls,
      durationMs: Date.now() - startTime,
      provenance,
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

/** Compute data provenance from an agent's tool calls */
function computeProvenance(toolCalls: AgentToolCall[]): DataProvenance {
  const webSearchTools = ['web_search', 'search_hotel_market', 'search_regulatory'];
  const externalApiTools = ['get_macro_indicators', 'get_city_profile', 'get_demand_signals', 'market_health'];
  const internalTools = new Set<string>();
  const externalApis = new Set<string>();
  let webSearches = 0;

  for (const tc of toolCalls) {
    if (webSearchTools.includes(tc.name)) {
      webSearches++;
      // Check if the search returned results
      if (tc.output && !tc.output.includes('"source":"unavailable"')) {
        externalApis.add('Web Search');
      }
    } else if (externalApiTools.includes(tc.name)) {
      // Check output for source info
      if (tc.output) {
        if (tc.output.includes('"source":"live"') || tc.output.includes('live-api')) {
          externalApis.add('Live Market API');
        }
        if (tc.output.includes('RBI')) externalApis.add('RBI');
        if (tc.output.includes('FRED')) externalApis.add('FRED');
        if (tc.output.includes('World Bank')) externalApis.add('World Bank');
        if (tc.output.includes('data.gov.in')) externalApis.add('data.gov.in');
      }
      internalTools.add(tc.name);
    } else {
      internalTools.add(tc.name);
    }
  }

  // Determine overall data quality
  let dataQuality: DataProvenance['dataQuality'];
  if (externalApis.size > 0 || webSearches > 0) {
    dataQuality = 'verified-external';
  } else if (internalTools.size > 0) {
    // Check if tools are computation engines vs reference data
    const computeTools = ['run_montecarlo', 'run_factor', 'run_sensitivity', 'run_stress_test', 'run_budget'];
    const hasCompute = [...internalTools].some(t => computeTools.includes(t));
    dataQuality = hasCompute ? 'internal-calculation' : 'reference-benchmark';
  } else {
    dataQuality = 'ai-estimate';
  }

  return {
    externalApis: [...externalApis],
    internalTools: [...internalTools],
    webSearches,
    dataQuality,
  };
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
    system: `You are an investment synthesis engine. You receive analysis from 16 specialist agents across four domains: Core Analysis, Compliance & Legal, Operations, and Strategy. You must produce a final verdict for a NAIVE INVESTOR who has no financial knowledge.

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

Here are the analyses from our 16 specialist agents:

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

    const body = await request.json();
    const parseResult = investAnalyzeSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const input = parseResult.data;

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

    // Step 2: Run all 16 agents in parallel (two batches)
    const VERDICT_AGENTS = [
      'market-analyst', 'deal-underwriter', 'portfolio-risk-officer', 'capital-allocator',
      'compliance-auditor', 'legal-regulatory', 'tax-strategist', 'forensic-auditor',
    ];
    const ENRICHMENT_AGENTS = [
      'construction-monitor', 'revenue-optimizer', 'proptech-advisor', 'insurance-protection',
      'esg-analyst', 'debt-structuring', 'lp-relations', 'exit-strategist',
    ];
    const ALL_AGENT_IDS = [...VERDICT_AGENTS, ...ENRICHMENT_AGENTS];

    const toolContext: ToolContext = {
      userId: userId,
      role: user?.role ?? 'lead_investor',
    };

    const dealName = input.propertyName;
    const city = input.city;

    // Build rich context string for agents
    const brandCtx = input.brandStrategy === 'independent' ? 'Operating independently (no franchise fees).'
      : input.brandStrategy === 'franchise' ? `Franchise model${input.preferredBrand ? ` (preferred: ${input.preferredBrand})` : ''} — ~10% fee leakage.`
      : input.brandStrategy === 'management_contract' ? `Management contract${input.preferredBrand ? ` with ${input.preferredBrand}` : ''} — ~13% fee leakage.`
      : 'Brand strategy undecided — analyze both independent and franchise scenarios.';
    const anchorCtx = input.hasAnchorPartnership
      ? `Has anchor partnerships (${input.anchorType ?? 'mixed'}) with ~${input.anchorCommittedNightsPerMonth ?? 0} committed room-nights/month.`
      : 'No anchor partnerships — fully open-market demand.';
    const demandCtx = `Demand mix: Corporate ${input.demandCorporatePct}%, Medical ${input.demandMedicalPct}%, Leisure ${input.demandLeisurePct}%, MICE ${input.demandMicePct}%.`;
    const partnerCtx = input.partnershipType === 'partnership'
      ? `JV structure: Lead ${input.leadInvestorPct ?? 50}% / P2 ${input.partner2Pct ?? 25}% / P3 ${input.partner3Pct ?? 25}%.`
      : 'Solo investment.';
    const richContext = `${demandCtx} ${anchorCtx} ${brandCtx} ${partnerCtx}`;

    const agentPrompts: Array<{ agentId: string; message: string }> = [
      // Verdict Agents
      {
        agentId: 'market-analyst',
        message: `Analyze the market conditions for a ${input.starRating}-star ${input.propertyType} hotel investment in ${city}, ${input.state}. The property is ${input.distanceToAirportKm}km from ${input.nearestAirport}. ${demandCtx} ${anchorCtx} What are the macro indicators, city-level demand signals, competitive dynamics, and overall market health? The deal is called "${dealName}".`,
      },
      {
        agentId: 'deal-underwriter',
        message: `Provide a full IC-ready analysis of the deal "${dealName}". Score all underwriting factors, run Monte Carlo simulation, and assess deal readiness. This is a ${input.starRating}-star, ${input.roomCount}-room ${input.propertyType} hotel in ${city}. ${richContext}`,
      },
      {
        agentId: 'portfolio-risk-officer',
        message: `Assess the portfolio risk impact of adding "${dealName}" — a ${input.starRating}-star hotel in ${city} with ₹${input.investmentAmountCr}Cr investment. ${partnerCtx} ${anchorCtx} Check risk concentration, run stress tests, and flag any concerns.`,
      },
      {
        agentId: 'capital-allocator',
        message: `Evaluate the capital allocation for "${dealName}" — ₹${input.investmentAmountCr}Cr into a ${input.starRating}-star hotel in ${city}. ${partnerCtx} ${brandCtx} Compare risk-adjusted returns against portfolio benchmarks and recommend whether this deployment makes sense.`,
      },
      {
        agentId: 'compliance-auditor',
        message: `Run a full compliance and audit check for "${dealName}". Verify hash chain integrity, SOC2 controls, audit trail completeness, and validation model status. ${partnerCtx}`,
      },
      {
        agentId: 'legal-regulatory',
        message: `Conduct a comprehensive legal and regulatory review for "${dealName}" in ${city}, ${input.state}. ${brandCtx} ${partnerCtx} Assess local zoning laws, environmental regulations, labor requirements, brand franchise agreements, and any licensing concerns for hotel operations.`,
      },
      {
        agentId: 'tax-strategist',
        message: `Develop a tax optimization strategy for "${dealName}". ${partnerCtx} ${brandCtx} Analyze depreciation schedules, applicable tax incentives, entity structure implications (including JV tax efficiency), and GST considerations for hotel investments in ${input.state}.`,
      },
      {
        agentId: 'forensic-auditor',
        message: `Perform a forensic financial audit of "${dealName}". ${richContext} Validate all projected assumptions, check for hidden contingencies, verify data integrity, and identify any accounting red flags in the deal model.`,
      },
      // Enrichment Agents
      {
        agentId: 'construction-monitor',
        message: `Analyze the construction budget and timeline for "${dealName}". This is a ${input.dealType === 'new_build' ? 'new construction' : input.dealType} project with ₹${input.investmentAmountCr}Cr investment. ${brandCtx} Check for budget variances, milestone risks, and brand-specific fit-out requirements.`,
      },
      {
        agentId: 'revenue-optimizer',
        message: `Analyze revenue optimization strategies for "${dealName}". ${demandCtx} ${anchorCtx} ${brandCtx} Review pricing models, revenue management tactics, anchor partnership revenue guarantees, segment mix optimization, and demand management to maximize ADR and occupancy.`,
      },
      {
        agentId: 'proptech-advisor',
        message: `Evaluate proptech and technology solutions for "${dealName}". ${brandCtx} Assess property management systems, automation opportunities, guest experience tech, and operational efficiency improvements. Consider brand-specific PMS requirements if applicable.`,
      },
      {
        agentId: 'insurance-protection',
        message: `Review insurance and risk protection for "${dealName}". ${partnerCtx} Recommend coverage for property, liability, loss of revenue, key-person insurance for partners, and other hospitality-specific insurance requirements.`,
      },
      {
        agentId: 'esg-analyst',
        message: `Conduct ESG analysis for "${dealName}". ${brandCtx} Evaluate sustainability practices, environmental impact, social responsibility, governance policies, and brand ESG compliance requirements for the hotel project.`,
      },
      {
        agentId: 'debt-structuring',
        message: `Optimize debt structuring for "${dealName}". ${partnerCtx} ${anchorCtx} Recommend financing mix, terms, covenants (leveraging anchor MoU guarantees if available), and refinancing strategies to maximize returns while managing leverage.`,
      },
      {
        agentId: 'lp-relations',
        message: `Model LP distributions and investor relations for "${dealName}". ${partnerCtx} Project cash flow distributions per partner, IRR scenarios by equity tranche, and create communication strategies for all investors. Include waterfall analysis.`,
      },
      {
        agentId: 'exit-strategist',
        message: `Develop exit strategies for "${dealName}". ${brandCtx} ${partnerCtx} Analyze refinancing options, sale scenarios (including brand premium/discount), recapitalization, tag-along/drag-along considerations, and timing for investor exit in ${input.timelineYears} years.`,
      },
    ];

    // Run agents in staggered batches of 4 to avoid Anthropic rate limits.
    // Each batch runs in parallel; batches are staggered by 1.5s.
    const BATCH_SIZE = 4;
    const BATCH_DELAY_MS = 1_500;

    const batches: Array<Array<{ agentId: string; message: string; idx: number }>> = [];
    for (let i = 0; i < agentPrompts.length; i += BATCH_SIZE) {
      batches.push(
        agentPrompts.slice(i, i + BATCH_SIZE).map((p, j) => ({ ...p, idx: i + j }))
      );
    }

    // Launch all batches concurrently, but stagger their start times
    const allSettled = new Array<PromiseSettledResult<AgentResult>>(agentPrompts.length);

    const batchPromises = batches.map((batch, batchIdx) =>
      (async () => {
        // Stagger: batch 0 starts immediately, batch 1 after 1.5s, batch 2 after 3s, etc.
        if (batchIdx > 0) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS * batchIdx));
        }
        const results = await Promise.allSettled(
          batch.map(({ agentId, message }) =>
            runSingleAgent(agentId, message, toolContext)
          )
        );
        // Place results back in original order
        results.forEach((result, i) => {
          allSettled[batch[i].idx] = result;
        });
      })()
    );

    await Promise.all(batchPromises);

    const agentResults: AgentResult[] = allSettled.map((settled, idx) => {
      if (settled.status === 'fulfilled') return settled.value;
      const agentId = agentPrompts[idx].agentId;
      const agent = getAgent(agentId);
      return {
        agentId,
        agentName: agent?.title ?? agentId,
        agentIcon: agent?.icon ?? '?',
        reply: `Analysis could not be completed: ${settled.reason instanceof Error ? settled.reason.message : String(settled.reason)}`,
        toolCalls: [],
        durationMs: 0,
        error: settled.reason instanceof Error ? settled.reason.message : String(settled.reason),
      };
    });

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

    // Persist invest analysis to DB so CFO briefing can always access it
    try {
      const { saveInvestAnalysis } = await import('@v3grand/db');
      await saveInvestAnalysis(db, {
        dealId: deal.id,
        verdict: synthesis.verdict,
        confidence: synthesis.confidence,
        summary: synthesis.summary,
        keyMetrics: synthesis.keyMetrics,
        warnings: synthesis.warnings,
        agentResults: agentResults.map(r => ({
          agentId: r.agentId,
          agentName: r.agentName,
          agentIcon: r.agentIcon,
          reply: r.reply,
          durationMs: r.durationMs,
          error: r.error,
          provenance: r.provenance,
        })),
      });
    } catch (persistErr) {
      console.error('Failed to persist invest analysis (non-fatal):', persistErr);
    }

    // Persist recommendation so the deal dashboard shows it immediately
    try {
      const { insertRecommendation } = await import('@v3grand/db');
      await insertRecommendation(db, {
        dealId: deal.id,
        scenarioKey: 'base',
        verdict: synthesis.verdict,
        confidence: synthesis.confidence,
        triggerEvent: 'invest.analyze',
        proformaSnapshot: synthesis.keyMetrics,
        gateResults: { warnings: synthesis.warnings },
        explanation: synthesis.summary,
        previousVerdict: null,
        isFlip: false,
      });
    } catch (recErr) {
      console.error('Failed to persist recommendation (non-fatal):', recErr);
    }

    return NextResponse.json(response);
  } catch (err) {
    console.error('POST /api/invest/analyze failed:', err);
    return NextResponse.json(
      { error: 'Analysis failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
