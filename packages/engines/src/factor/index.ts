// ─── Factor Engine: 4-Domain Weighted Scoring ──────────────────────
// Pure function: (FactorScoreInput) => FactorScoreOutput
// Evaluates deal quality across Global, Local, Asset, and Sponsor domains.
// Composite score drives the implied required return (discount rate).

import type {
  FactorScoreInput, FactorScoreOutput, FactorDetail, MacroIndicators,
} from '@v3grand/core';
import { clamp } from '../_shared/distributions.js';

// ── Default macro indicators (India baseline) ──
// Updated 2026-03-04 from RBI MPC (Feb 7, 2026), MOSPI (Feb 12, 2026)
// These are ONLY used when MarketDataService is completely unavailable.
// In normal operation, live values are passed via macroIndicators param.
const DEFAULT_MACRO: MacroIndicators = {
  repoRate: 0.0525,             // RBI repo rate (Feb 2026 MPC)
  cpi: 0.0275,                  // CPI YoY (Jan 2026, MOSPI)
  gdpGrowthRate: 0.065,         // GDP FY2024-25 provisional
  bondYield10Y: 0.0670,         // 10Y G-Sec yield (CCIL, Mar 2026)
  hotelSupplyGrowthPct: 0.03,
};

// ── Domain weights (sum to 1.0) ──
const DOMAIN_WEIGHTS = {
  global: 0.25,
  local: 0.25,
  asset: 0.30,
  sponsor: 0.20,
};

export function scoreFactors(input: FactorScoreInput): FactorScoreOutput {
  const { deal } = input;
  const macro = input.macroIndicators ?? DEFAULT_MACRO;

  // Score each domain (1-5 scale)
  const globalFactors = scoreGlobalDomain(macro);
  const localFactors = scoreLocalDomain(deal, macro);
  const assetFactors = scoreAssetDomain(deal);
  const sponsorFactors = scoreSponsorDomain(deal);

  const allFactors = [...globalFactors, ...localFactors, ...assetFactors, ...sponsorFactors];

  // Compute domain scores as DomainScoreDetail objects
  const buildDomainScore = (domain: FactorDetail['domain']) => {
    const domainFactors = allFactors.filter(f => f.domain === domain);
    if (domainFactors.length === 0) {
      return {
        score: 3.0,
        weight: DOMAIN_WEIGHTS[domain],
        factors: [],
      };
    }
    const totalWeight = domainFactors.reduce((s, f) => s + f.weight, 0);
    const score = round2(domainFactors.reduce((s, f) => s + f.score * (f.weight / totalWeight), 0));
    return {
      score,
      weight: DOMAIN_WEIGHTS[domain],
      factors: domainFactors,
    };
  };

  const domainScores = {
    global: buildDomainScore('global'),
    local: buildDomainScore('local'),
    asset: buildDomainScore('asset'),
    sponsor: buildDomainScore('sponsor'),
  };

  // Weighted composite
  const compositeScore = round2(
    domainScores.global.score * DOMAIN_WEIGHTS.global +
    domainScores.local.score * DOMAIN_WEIGHTS.local +
    domainScores.asset.score * DOMAIN_WEIGHTS.asset +
    domainScores.sponsor.score * DOMAIN_WEIGHTS.sponsor
  );

  // Implied required return: riskFree + (5 - composite) * 3%
  // Higher composite → lower required return. Score of 5 → riskFree + 0%. Score of 1 → riskFree + 12%.
  const impliedDiscountRate = round4(
    deal.financialAssumptions.riskFreeRate + (5 - compositeScore) * 0.03
  );
  const impliedCapRate = round4(compositeScore * 0.005 + 0.04); // Simple approximation

  return {
    compositeScore,
    impliedDiscountRate,
    impliedCapRate,
    domainScores,
  };
}

// ─── Domain Scorers ────────────────────────────────────────────────

function scoreGlobalDomain(macro: MacroIndicators): FactorDetail[] {
  return [
    {
      name: 'Repo Rate',
      domain: 'global',
      weight: 0.30,
      score: clamp(5 - (macro.repoRate - 0.05) * 40, 1, 5),
      rationale: `RBI repo rate at ${(macro.repoRate * 100).toFixed(1)}%. Lower rates favor hotel investment.`,
    },
    {
      name: 'GDP Growth',
      domain: 'global',
      weight: 0.30,
      score: clamp(1 + macro.gdpGrowthRate * 40, 1, 5),
      rationale: `GDP growth at ${(macro.gdpGrowthRate * 100).toFixed(1)}%. Higher growth drives travel demand.`,
    },
    {
      name: 'Inflation (CPI)',
      domain: 'global',
      weight: 0.20,
      score: clamp(5 - (macro.cpi - 0.04) * 30, 1, 5),
      rationale: `CPI at ${(macro.cpi * 100).toFixed(1)}%. Moderate inflation is manageable.`,
    },
    {
      name: 'Bond Yield Spread',
      domain: 'global',
      weight: 0.20,
      score: clamp(5 - (macro.bondYield10Y - 0.06) * 30, 1, 5),
      rationale: `10Y bond yield at ${(macro.bondYield10Y * 100).toFixed(1)}%. Lower yields improve relative attractiveness.`,
    },
  ];
}

function scoreLocalDomain(deal: FactorScoreInput['deal'], macro: MacroIndicators): FactorDetail[] {
  const loc = deal.property.location;
  const airportProximity = loc.distanceToAirportKm;

  return [
    {
      name: 'Airport Proximity',
      domain: 'local',
      weight: 0.30,
      score: clamp(5 - (airportProximity - 5) * 0.2, 1, 5),
      rationale: `${airportProximity} km from airport. Closer proximity boosts accessibility.`,
    },
    {
      name: 'Market Supply Growth',
      domain: 'local',
      weight: 0.30,
      score: clamp(5 - macro.hotelSupplyGrowthPct * 20, 1, 5),
      rationale: `Local hotel supply growing at ${(macro.hotelSupplyGrowthPct * 100).toFixed(1)}%. Lower supply growth reduces competition.`,
    },
    {
      name: 'Medical Corridor',
      domain: 'local',
      weight: 0.20,
      // Madurai is a known medical tourism hub — score based on city
      score: loc.city.toLowerCase().includes('madurai') ? 4.5 : 3.0,
      rationale: `${loc.city} medical tourism potential. Proximity to hospitals drives year-round demand.`,
    },
    {
      name: 'Tourism Demand',
      domain: 'local',
      weight: 0.20,
      // Base score on city tier and temple/cultural significance
      score: loc.city.toLowerCase().includes('madurai') ? 4.0 : 3.0,
      rationale: `${loc.city} cultural and religious tourism demand. Meenakshi Temple is a world-famous draw.`,
    },
  ];
}

function scoreAssetDomain(deal: FactorScoreInput['deal']): FactorDetail[] {
  const prop = deal.property;
  const mkt = deal.marketAssumptions;
  const fin = deal.financialAssumptions;

  // Stabilized occupancy from base scenario
  const baseScenario = deal.scenarios.base;
  const stabOcc = baseScenario?.occupancyStabilized ?? 0.75;
  const stabAdr = baseScenario?.adrStabilized ?? mkt.adrStabilized;

  return [
    {
      name: 'Star Rating',
      domain: 'asset',
      weight: 0.15,
      score: clamp(prop.starRating, 1, 5),
      rationale: `${prop.starRating}-star property. Higher star rating indicates quality positioning.`,
    },
    {
      name: 'Stabilized Occupancy',
      domain: 'asset',
      weight: 0.25,
      score: clamp(stabOcc * 6.25, 1, 5), // 80% occ → 5.0
      rationale: `Stabilized occupancy of ${(stabOcc * 100).toFixed(0)}%. Higher occupancy indicates strong demand.`,
    },
    {
      name: 'ADR Competitiveness',
      domain: 'asset',
      weight: 0.20,
      // Score based on ADR level relative to a 4-star benchmark of ₹5000
      score: clamp(3 + (stabAdr - 5000) / 2000, 1, 5),
      rationale: `Stabilized ADR of ₹${stabAdr.toFixed(0)}. Competitive pricing supports revenue targets.`,
    },
    {
      name: 'Phase 2 Optionality',
      domain: 'asset',
      weight: 0.15,
      score: prop.keys.phase2 > 0 ? 4.0 : 2.5,
      rationale: prop.keys.phase2 > 0
        ? `Phase 2 adds ${prop.keys.phase2} keys — provides growth optionality.`
        : 'No Phase 2 expansion planned. Limited growth upside.',
    },
    {
      name: 'CAPEX Discipline',
      domain: 'asset',
      weight: 0.25,
      // Lower cost per key is better. Benchmark: ₹60 lakh/key for 4-star
      score: (() => {
        const totalKeys = prop.keys.total;
        const totalCapexCr = deal.capexPlan.phase1.totalBudgetCr + deal.capexPlan.phase2.totalBudgetCr;
        const costPerKeyCr = totalCapexCr / totalKeys;
        const costPerKeyLakh = costPerKeyCr * 100; // Cr to Lakh
        return clamp(5 - (costPerKeyLakh - 40) * 0.05, 1, 5);
      })(),
      rationale: `CAPEX per key evaluated against 4-star benchmarks. Lower is better.`,
    },
  ];
}

function scoreSponsorDomain(deal: FactorScoreInput['deal']): FactorDetail[] {
  const partnership = deal.partnership;
  const partners = partnership.partners;
  const leadInvestor = partners.find(p => p.role === 'lead-investor');
  const operator = partners.find(p => p.role === 'operator');

  return [
    {
      name: 'JV Structure',
      domain: 'sponsor',
      weight: 0.25,
      score: partnership.structure === 'jv' ? 4.0 : partnership.structure === 'sole' ? 3.0 : 3.5,
      rationale: `${partnership.structure.toUpperCase()} structure. JV provides risk sharing and diverse expertise.`,
    },
    {
      name: 'Lead Investor Commitment',
      domain: 'sponsor',
      weight: 0.30,
      score: leadInvestor
        ? clamp(leadInvestor.equityPct * 8, 1, 5) // 50% equity → 4.0, 65%+ → 5.0
        : 2.0,
      rationale: leadInvestor
        ? `Lead investor at ${(leadInvestor.equityPct * 100).toFixed(0)}% equity. High commitment signals confidence.`
        : 'No lead investor identified.',
    },
    {
      name: 'Operator Presence',
      domain: 'sponsor',
      weight: 0.25,
      score: operator ? 4.0 : 2.0,
      rationale: operator
        ? `Operator partner identified (${operator.name}). Operations expertise reduces execution risk.`
        : 'No dedicated operator. Higher operational risk.',
    },
    {
      name: 'Capital Adequacy',
      domain: 'sponsor',
      weight: 0.20,
      score: (() => {
        const totalCommitment = partners.reduce((sum, p) => sum + p.commitmentCr, 0);
        const requiredEquity = deal.capexPlan.phase1.totalBudgetCr * deal.financialAssumptions.equityRatio;
        const ratio = totalCommitment / (requiredEquity || 1);
        return clamp(ratio * 3, 1, 5); // 1.0x → 3.0, 1.5x → 4.5
      })(),
      rationale: `Total partner commitments vs required equity. Higher ratio provides cushion for overruns.`,
    },
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
