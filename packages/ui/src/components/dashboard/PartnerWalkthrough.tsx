'use client';

/**
 * Partner Walkthrough — CFO Investment Committee briefing.
 * Generates a comprehensive, CFO-caliber narrative from live deal data: covers capital structure,
 * return spread analysis (IRR vs WACC, basis points), DSCR covenant compliance, Monte Carlo
 * distribution (P10/P50/P90), market factor scores, construction execution risk, recommendation
 * trajectory, and LP-facing closing. Adapts tone to verdict confidence — speaks with conviction
 * when warranted, flags concerns when the numbers demand it.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DealDashboardView } from '@v3grand/core';

const WALKTHROUGH_LABEL = 'CFO investment briefing';
const VOICE_PREFERENCE = 'en-IN';

// ─── Formatting helpers ────────────────────────────────────────────
const fmtPct = (v: number) => `${(v * 100).toFixed(1)} percent`;
const fmtCr = (v: number) => `${(v / 1e7).toFixed(1)} crore`;
const fmtBps = (v: number) => `${Math.round(v * 10000)} basis points`;
const fmtX = (v: number) => `${v.toFixed(2)} times`;
const fmtYr = (v: number) => `year ${v}`;

// ─── Build CFO-caliber Investment Committee Walkthrough ────────────
function buildPartnerWalkthroughScript(data: DealDashboardView): string {
  const {
    deal, property, partnership, latestRecommendation, latestProforma,
    decisionInsight, latestMC, latestFactor, latestBudget,
    constructionProgress, budgetSummary, recommendationHistory,
    financialAssumptions, marketAssumptions, capexPlan,
  } = data;

  const prop = property as {
    location?: { city?: string; state?: string; distanceToAirportKm?: number };
    grossBUA?: { totalSqft?: number };
    starRating?: number;
    keys?: { total?: number };
    amenities?: string[];
  } | undefined;

  const fin = financialAssumptions as {
    wacc?: number; targetIRR?: number; equityRatio?: number; debtRatio?: number;
    debtInterestRate?: number; debtTenorYears?: number; exitCapRate?: number;
    taxRate?: number; managementFeePct?: number; targetDSCR?: number;
    targetEquityMultiple?: number;
  } | null;

  const mkt = marketAssumptions as {
    adrBase?: number; adrStabilized?: number; adrGrowthRate?: number;
    occupancyRamp?: number[]; segments?: Array<{ name: string; pctMix: number }>;
    compSet?: Array<{ name: string; adr: number; occ: number; revpar: number }>;
    revenueMix?: { rooms: number; fb: number; banquet: number; other: number };
  } | null;

  const ptrs = partnership as {
    structure?: string;
    partners?: Array<{ name: string; equityPct: number; role: string; commitmentCr: number }>;
  } | undefined;

  const location = prop?.location?.city && prop?.location?.state
    ? `${prop.location.city}, ${prop.location.state}`
    : prop?.location?.city ?? null;

  const parts: string[] = [];

  // ━━ §1: OPENING — Set the room, establish authority ━━━━━━━━━━━━━
  parts.push(`Members of the Investment Committee: this is the CFO's assessment of ${deal.name}.`);

  // Asset identity in one dense sentence
  const identifiers: string[] = [];
  if (prop?.starRating) identifiers.push(`${prop.starRating}-star`);
  if (prop?.keys?.total) identifiers.push(`${prop.keys.total}-key`);
  if (prop?.grossBUA?.totalSqft) identifiers.push(`${(prop.grossBUA.totalSqft / 1000).toFixed(0)}K square feet`);
  if (location) identifiers.push(`located in ${location}`);
  if (identifiers.length > 0) {
    parts.push(`The asset is a ${identifiers.join(', ')}.`);
  }

  if (deal.lifecyclePhase && deal.lifecyclePhase !== 'pre-development') {
    parts.push(`We are in ${deal.lifecyclePhase.replace(/-/g, ' ')} phase, month ${deal.currentMonth} of execution.`);
  }

  // ━━ §2: CAPITAL STRUCTURE — How the deal is funded ━━━━━━━━━━━━━━
  if (fin || ptrs) {
    const structureParts: string[] = [];
    if (fin?.equityRatio && fin?.debtRatio) {
      structureParts.push(`The capital structure is ${Math.round(fin.equityRatio * 100)}/${Math.round(fin.debtRatio * 100)} equity-to-debt`);
    }
    if (fin?.debtInterestRate) {
      structureParts.push(`debt priced at ${fmtPct(fin.debtInterestRate)}`);
    }
    if (fin?.debtTenorYears) {
      structureParts.push(`${fin.debtTenorYears}-year tenor`);
    }
    if (structureParts.length > 0) {
      parts.push(structureParts.join(', ') + '.');
    }

    if (ptrs?.structure) {
      const structureLabel = ptrs.structure === 'jv' ? 'joint venture'
        : ptrs.structure === 'syndication' ? 'syndication'
        : 'sole ownership';
      parts.push(`Partnership structure is ${structureLabel}.`);
      const lead = ptrs.partners?.find(p => p.role === 'lead-investor');
      if (lead) {
        parts.push(`${lead.name} leads with ${Math.round(lead.equityPct * 100)} percent equity, ${fmtCr(lead.commitmentCr * 1e7)} committed.`);
      }
    }
  }

  // ━━ §3: INVESTMENT THESIS — Verdict with conviction framing ━━━━━
  if (latestRecommendation) {
    const verdict = latestRecommendation.verdict;
    const confidence = latestRecommendation.confidence;

    // Detect verdict trajectory from history
    const history = recommendationHistory ?? [];
    const hasFlipped = history.length > 1 && history[0]?.verdict !== history[1]?.verdict;
    const prevVerdict = hasFlipped ? history[1]?.verdict : null;

    if (hasFlipped && prevVerdict) {
      parts.push(`This deal has migrated from ${prevVerdict} to ${verdict}—a material shift in our position.`);
    }

    // CFO-caliber verdict language
    const confidenceLevel = confidence >= 80 ? 'high' : confidence >= 60 ? 'moderate' : confidence >= 40 ? 'guarded' : 'low';
    switch (verdict) {
      case 'INVEST':
        if (confidenceLevel === 'high') {
          parts.push(`Our recommendation to the IC is to proceed with capital deployment. We carry ${confidence} percent confidence—this clears our institutional threshold for commitment.`);
        } else {
          parts.push(`The recommendation is Invest, but I want the committee to note that confidence sits at ${confidence} percent. We are proceeding, but not with full conviction—conditions apply.`);
        }
        break;
      case 'HOLD':
        parts.push(`We are recommending Hold at ${confidence} percent confidence. This is not a rejection—it is a deliberate pause. We need resolution on specific gates before I can bring this back as an Invest.`);
        break;
      case 'DE-RISK':
        parts.push(`The IC should not approve capital deployment in the current structure. Our position is De-risk at ${confidence} percent confidence. The return profile does not justify the risk without structural improvements.`);
        break;
      case 'EXIT':
        parts.push(`My recommendation is Exit. At ${confidence} percent confidence, the risk-return profile has deteriorated to a point where continued capital exposure is not defensible to our LPs.`);
        break;
      case 'DO-NOT-PROCEED':
        parts.push(`I am recommending Do Not Proceed. The fundamental investment criteria are not met at ${confidence} percent confidence. Deploying capital here would be inconsistent with our fiduciary obligations.`);
        break;
      default:
        parts.push(`Current position is ${verdict} with ${confidence} percent confidence.`);
    }

    // Investment thesis narrative
    const hasNarrative = decisionInsight?.narrative?.trim()?.length && decisionInsight.narrative.trim().length > 30;
    const explanation = latestRecommendation.explanation?.trim();
    const hasExplanation = explanation && explanation.length > 20;

    if (hasNarrative) {
      parts.push("The investment thesis in summary: " + decisionInsight!.narrative!.trim());
    } else if (hasExplanation) {
      parts.push("Rationale: " + explanation!);
    }
  } else {
    parts.push("The underwriting engine has not been run. I cannot present a position to the IC without a completed decision analysis. We need to run the full engine suite before this committee can act.");
  }

  // ━━ §4: RETURN PROFILE — Deep financial interpretation ━━━━━━━━━━
  if (latestProforma) {
    const irr = latestProforma.irr;
    const npv = latestProforma.npv;
    const em = latestProforma.equityMultiple;
    const payback = latestProforma.paybackYear;
    const dscr = latestProforma.avgDSCR;
    const exitVal = latestProforma.exitValue;
    const totalInv = latestProforma.totalInvestment;
    const eqInv = latestProforma.equityInvestment;

    // WACC spread analysis
    const wacc = fin?.wacc ?? 0;
    const targetIRR = fin?.targetIRR ?? 0;
    const irrSpreadOverWacc = irr - wacc;
    const irrSpreadOverTarget = irr - targetIRR;

    parts.push(`Base case return profile: IRR of ${fmtPct(irr)}, NPV of ${fmtCr(npv)}, equity multiple ${fmtX(em)}, payback in ${fmtYr(payback)}.`);

    // Spread analysis — this is what separates a CFO from a CTO reading
    if (wacc > 0) {
      if (irrSpreadOverWacc > 0) {
        parts.push(`The IRR clears our weighted average cost of capital by ${fmtBps(irrSpreadOverWacc)}—that spread is the value creation margin we are underwriting.`);
      } else {
        parts.push(`I need to flag that the IRR falls short of WACC by ${fmtBps(Math.abs(irrSpreadOverWacc))}. We are destroying value on a risk-adjusted basis in the base case.`);
      }
    }
    if (targetIRR > 0 && targetIRR !== wacc) {
      if (irrSpreadOverTarget >= 0) {
        parts.push(`The return exceeds our target IRR of ${fmtPct(targetIRR)} by ${fmtBps(irrSpreadOverTarget)}.`);
      } else {
        parts.push(`We are ${fmtBps(Math.abs(irrSpreadOverTarget))} below our target IRR of ${fmtPct(targetIRR)}—this is the gap the committee needs to assess.`);
      }
    }

    // DSCR — debt serviceability
    if (dscr && dscr > 0) {
      const targetDSCR = fin?.targetDSCR ?? 1.3;
      if (dscr >= targetDSCR) {
        parts.push(`Average debt service coverage ratio is ${dscr.toFixed(2)}x, above our ${targetDSCR}x covenant threshold—lender comfort is intact.`);
      } else {
        parts.push(`DSCR at ${dscr.toFixed(2)}x is below our ${targetDSCR}x covenant floor. This is a red flag—any revenue stress could trigger a covenant breach.`);
      }
    }

    // Capital efficiency
    if (totalInv && eqInv && exitVal) {
      parts.push(`Total capital deployed is ${fmtCr(totalInv)} of which ${fmtCr(eqInv)} is equity. Terminal value at exit is ${fmtCr(exitVal)}.`);
    }

    // Equity multiple context
    const targetEM = fin?.targetEquityMultiple ?? 1.8;
    if (em >= targetEM) {
      parts.push(`Equity multiple of ${fmtX(em)} exceeds our ${fmtX(targetEM)} threshold—LPs will see adequate capital appreciation.`);
    } else if (em >= 1.5) {
      parts.push(`Equity multiple of ${fmtX(em)} is acceptable but below our ${fmtX(targetEM)} institutional benchmark.`);
    } else if (em < 1.5) {
      parts.push(`Equity multiple of ${fmtX(em)} is thin. On a risk-adjusted basis, our LPs can access better returns in comparable hospitality assets.`);
    }
  }

  // ━━ §5: MARKET POSITIONING — Revenue assumptions and comp set ━━━
  if (mkt) {
    const mktParts: string[] = [];
    if (mkt.adrBase && mkt.adrStabilized) {
      mktParts.push(`We are underwriting a base ADR of ${Math.round(mkt.adrBase)} rupees ramping to ${Math.round(mkt.adrStabilized)} at stabilization`);
    }
    if (mkt.adrGrowthRate) {
      mktParts.push(`growing at ${fmtPct(mkt.adrGrowthRate)} annually`);
    }
    if (mktParts.length > 0) {
      parts.push(mktParts.join(', ') + '.');
    }

    if (mkt.occupancyRamp?.length) {
      const yr1Occ = mkt.occupancyRamp[0];
      const stabilizedOcc = mkt.occupancyRamp[mkt.occupancyRamp.length - 1];
      const rampYears = mkt.occupancyRamp.findIndex(o => o >= stabilizedOcc * 0.95) + 1;
      if (yr1Occ && stabilizedOcc) {
        parts.push(`Occupancy ramps from ${Math.round(yr1Occ * 100)} percent in year one to ${Math.round(stabilizedOcc * 100)} percent at stabilization${rampYears > 0 ? `, achieved by year ${rampYears}` : ''}.`);
      }
    }

    // Comp set benchmarking
    if (mkt.compSet?.length) {
      const avgCompRevpar = mkt.compSet.reduce((s, c) => s + c.revpar, 0) / mkt.compSet.length;
      parts.push(`The competitive set comprises ${mkt.compSet.length} properties averaging ${Math.round(avgCompRevpar)} rupees RevPAR. Our underwriting assumption should be validated against this benchmark.`);
    }

    // Revenue diversification
    if (mkt.revenueMix) {
      const rm = mkt.revenueMix;
      const nonRoomPct = Math.round(((rm.fb ?? 0) + (rm.banquet ?? 0) + (rm.other ?? 0)) * 100);
      if (nonRoomPct > 0) {
        parts.push(`Revenue mix is ${Math.round((rm.rooms ?? 0) * 100)} percent rooms and ${nonRoomPct} percent ancillary—F&B, banqueting, and other. That diversification reduces single-source dependency.`);
      }
    }
  }

  // ━━ §6: RISK FRAMEWORK — Drivers, risks, and gates ━━━━━━━━━━━━━
  if (decisionInsight) {
    const drivers = decisionInsight.topDrivers?.filter(Boolean).slice(0, 3) ?? [];
    const risks = decisionInsight.topRisks?.filter(Boolean).slice(0, 3) ?? [];
    const riskFlags = decisionInsight.riskFlags?.filter(Boolean) ?? [];
    const flipConditions = decisionInsight.flipConditions?.filter(Boolean) ?? [];

    if (drivers.length > 0) {
      parts.push("The primary investment drivers supporting this position: " + drivers.join("; ") + ".");
    }
    if (risks.length > 0) {
      parts.push("Key risk factors under active monitoring: " + risks.join("; ") + ".");
    }
    if (riskFlags.length > 0) {
      parts.push(`We are carrying ${riskFlags.length} active risk flag${riskFlags.length > 1 ? 's' : ''}: ${riskFlags.join(', ')}.`);
    }
    if (flipConditions.length > 0) {
      parts.push("For the committee's reference, what would flip this verdict: " + flipConditions.slice(0, 2).join("; ") + ".");
    }
  }

  // ━━ §7: MONTE CARLO — Probabilistic downside analysis ━━━━━━━━━━
  if (latestMC) {
    const mc = latestMC as any;
    const pNpvNeg = mc.probNpvNegative ?? mc.probNpvNeg;
    const pIrrBelowWacc = mc.probIrrBelowWacc;
    const p10Irr = mc.p10Irr ?? mc.percentiles?.p10;
    const p50Irr = mc.p50Irr ?? mc.percentiles?.p50;
    const p90Irr = mc.p90Irr ?? mc.percentiles?.p90;

    if (typeof pNpvNeg === 'number') {
      const pNegPct = Math.round(pNpvNeg * 100);
      if (pNegPct > 30) {
        parts.push(`Monte Carlo analysis across 5,000 scenarios flags significant tail risk: ${pNegPct} percent probability of capital loss. This is above our institutional comfort threshold and is a primary reason for caution.`);
      } else if (pNegPct > 15) {
        parts.push(`Monte Carlo analysis shows ${pNegPct} percent probability of negative NPV. That is moderate downside—present but manageable if our assumptions hold.`);
      } else {
        parts.push(`Downside is well-contained: only ${pNegPct} percent probability of capital loss across 5,000 Monte Carlo scenarios.`);
      }
    }

    // IRR distribution context
    if (typeof p10Irr === 'number' && typeof p50Irr === 'number' && typeof p90Irr === 'number') {
      parts.push(`IRR distribution: P10 at ${fmtPct(p10Irr)}, median at ${fmtPct(p50Irr)}, P90 at ${fmtPct(p90Irr)}. That range tells you the volatility embedded in this return profile.`);
    }

    if (typeof pIrrBelowWacc === 'number') {
      parts.push(`Probability of IRR falling below cost of capital is ${Math.round(pIrrBelowWacc * 100)} percent.`);
    }
  }

  // ━━ §8: FACTOR SCORE — Market and asset quality ━━━━━━━━━━━━━━━━
  if (latestFactor) {
    const factor = latestFactor as any;
    const composite = factor.compositeScore ?? factor.score;
    const impliedCapRate = factor.impliedCapRate;
    if (typeof composite === 'number') {
      const assessment = composite >= 4.0 ? 'strong' : composite >= 3.0 ? 'adequate' : 'below institutional grade';
      parts.push(`Market and asset factor composite score is ${composite.toFixed(1)} out of 5—${assessment} for our portfolio standards.`);
    }
    if (typeof impliedCapRate === 'number') {
      parts.push(`Factor-implied cap rate is ${fmtPct(impliedCapRate)}${fin?.exitCapRate ? ` versus our exit assumption of ${fmtPct(fin.exitCapRate)}` : ''}.`);
    }
  }

  // ━━ §9: CONSTRUCTION & BUDGET — Execution risk ━━━━━━━━━━━━━━━━━
  const hasConstruction = constructionProgress && (constructionProgress.completionPct ?? 0) > 0;
  const hasBudget = budgetSummary && budgetSummary.overallStatus;

  if (hasConstruction || hasBudget) {
    parts.push("On execution risk.");

    if (hasConstruction) {
      const pct = Math.round((constructionProgress!.completionPct ?? 0) * 100);
      const variance = constructionProgress!.variance;
      parts.push(`Construction is ${pct} percent complete.`);
      if (typeof variance === 'number') {
        if (Math.abs(variance) < 0.03) {
          parts.push("Budget tracking is within tolerance.");
        } else if (variance > 0) {
          parts.push(`We are running ${Math.round(variance * 100)} percent over budget—this compresses returns and needs to be contained.`);
        } else {
          parts.push(`We are ${Math.round(Math.abs(variance) * 100)} percent under budget, which provides return upside if sustained.`);
        }
      }
    }

    if (hasBudget) {
      const status = budgetSummary!.overallStatus;
      if (status === 'RED') {
        parts.push("Budget status is Red. I want the committee aware that construction cost overruns are actively eroding the underwritten return profile.");
      } else if (status === 'AMBER') {
        parts.push("Budget is at Amber—we are monitoring closely, but no material return impact yet.");
      }
      if (budgetSummary!.alerts?.length) {
        parts.push(`There are ${budgetSummary!.alerts!.length} active budget alert${budgetSummary!.alerts!.length > 1 ? 's' : ''} requiring management attention.`);
      }
    }
  }

  // ━━ §10: RECOMMENDATION TRAJECTORY — Pattern analysis ━━━━━━━━━━
  if (recommendationHistory && recommendationHistory.length > 2) {
    const recent = recommendationHistory.slice(0, 3);
    const allSame = recent.every(r => r.verdict === recent[0].verdict);
    if (allSame) {
      parts.push(`The recommendation has been stable at ${recent[0].verdict} across the last ${recent.length} engine runs—directional consistency gives us additional comfort.`);
    } else {
      const verdicts = recent.map(r => r.verdict).join(' → ');
      parts.push(`Recommendation trajectory over the last ${recent.length} runs: ${verdicts}. The committee should note this volatility in the decision signal.`);
    }
  }

  // ━━ §11: CLOSING — CFO summary to IC ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const verdict = latestRecommendation?.verdict;
  if (verdict === 'INVEST') {
    parts.push("To close: the numbers support deployment, risk is quantified and within tolerance, and execution is tracking. I am comfortable presenting this to LPs as a portfolio addition. The committee has the full pack for due diligence; Assumptions and Sensitivity tabs are available for stress-testing. I will take questions.");
  } else if (verdict === 'HOLD') {
    parts.push("To close: we are not asking for capital commitment today. The ask is for the committee to maintain allocation and allow us to resolve the open gates. I will bring this back when conviction has improved. I will take questions.");
  } else if (verdict === 'DE-RISK') {
    parts.push("To close: I am asking the committee to mandate restructuring before any further capital is deployed. The specific conditions for re-evaluation are outlined in the flip conditions above. I will take questions.");
  } else if (verdict === 'EXIT' || verdict === 'DO-NOT-PROCEED') {
    parts.push("To close: continuing capital exposure is not supportable on the current metrics. My recommendation is to proceed with an orderly exit or to not deploy. The committee's fiduciary obligation is clear on this one. I will take questions.");
  } else {
    parts.push("The full detail is available in the pack. Assumptions and What-If scenarios are available for the committee's independent stress-testing. I will take questions.");
  }

  return parts.join(" ");
}

export interface PartnerWalkthroughProps {
  /** Dashboard data (deal, recommendation, proforma, decisionInsight, etc.) */
  data: DealDashboardView | null;
  /** Optional CSS class for the container */
  className?: string;
  /** Compact mode: single icon button without "Show script" */
  compact?: boolean;
}

export function PartnerWalkthrough({ data, className = '', compact = false }: PartnerWalkthroughProps) {
  const [playing, setPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [paused, setPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const scriptRef = useRef<string>('');

  const script = data ? buildPartnerWalkthroughScript(data) : '';

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setPaused(false);
  }, []);

  const play = useCallback(() => {
    if (!script || typeof window === 'undefined' || !window.speechSynthesis) return;
    if (playing && !paused) {
      window.speechSynthesis.pause();
      setPaused(true);
      return;
    }
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      return;
    }
    scriptRef.current = script;
    const u = new SpeechSynthesisUtterance(script);
    u.rate = 0.92;
    u.pitch = 1;
    u.volume = 1;
    u.lang = VOICE_PREFERENCE;
    u.onend = () => {
      setPlaying(false);
      setPaused(false);
    };
    u.onerror = () => {
      setPlaying(false);
      setPaused(false);
    };
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
    setPlaying(true);
    setPaused(false);
  }, [script, playing, paused]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!data) return null;

  const canPlay = script.length > 0;
  const isActive = playing && !paused;

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={canPlay ? play : undefined}
          disabled={!canPlay}
          className={`
            inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors
            ${canPlay
              ? 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1'
              : 'border-surface-200 bg-surface-50 text-surface-400 cursor-not-allowed'}
          `}
          aria-label={isActive ? 'Pause investment briefing' : 'Play CFO investment briefing'}
          title={WALKTHROUGH_LABEL}
        >
          {isActive ? (
            <>
              <PauseIcon className="w-4 h-4" />
              <span>Pause</span>
            </>
          ) : playing && paused ? (
            <>
              <PlayIcon className="w-4 h-4" />
              <span>Resume</span>
            </>
          ) : (
            <>
              <SpeakerIcon className="w-4 h-4" />
              <span>{compact ? 'Listen' : WALKTHROUGH_LABEL}</span>
            </>
          )}
        </button>
        {playing && (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
            aria-label="Stop walkthrough"
          >
            <StopIcon className="w-4 h-4" />
            <span>Stop</span>
          </button>
        )}
        {!compact && (
          <button
            type="button"
            onClick={() => setShowScript((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
          >
            {showScript ? 'Hide script' : 'Show script'}
          </button>
        )}
      </div>
      {showScript && script && (
        <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50/50 p-4">
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">CFO Investment Committee briefing — read along</p>
          <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">{script}</p>
        </div>
      )}
    </div>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 6h12v12H6z" />
    </svg>
  );
}

export default PartnerWalkthrough;
