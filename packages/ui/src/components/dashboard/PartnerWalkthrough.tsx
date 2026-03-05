'use client';

/**
 * Partner Walkthrough — CTO / Senior Partner board briefing.
 * Builds a context-aware narrative from live deal data: explains *why* the decision holds,
 * reacts to confidence, metrics, drivers and risks so it feels like a human reading the room,
 * not a fixed script.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DealDashboardView } from '@v3grand/core';

const WALKTHROUGH_LABEL = 'CTO board briefing';
const VOICE_PREFERENCE = 'en-IN';

// Typical hurdle reference (context-only; we don't have deal-specific hurdle in view)
const IRR_HURDLE_TYPICAL = 0.18;
const PAYBACK_TYPICAL_YEARS = 6;

function buildPartnerWalkthroughScript(data: DealDashboardView): string {
  const { deal, property, latestRecommendation, latestProforma, decisionInsight, latestMC, constructionProgress } = data;
  const prop = property as { location?: { city?: string; state?: string }; grossBUA?: number; starRating?: number } | undefined;
  const location = prop?.location?.city && prop?.location?.state
    ? `${prop.location.city}, ${prop.location.state}`
    : prop?.location?.city ?? null;
  const parts: string[] = [];

  // —— Opening (contextual)
  parts.push(`For the board: ${deal.name}.`);
  if (deal.lifecyclePhase && deal.lifecyclePhase !== 'pre-development') {
    parts.push(`We are at ${deal.lifecyclePhase.replace(/-/g, ' ')}, month ${deal.currentMonth}.`);
  }
  if (location) {
    parts.push(`Asset sits in ${location}.`);
  }
  parts.push("I will lay out our position, why we are taking it, and what you need to take away.");

  // —— Recommendation: tone and nuance from confidence + verdict
  if (latestRecommendation) {
    const verdict = latestRecommendation.verdict;
    const confidence = latestRecommendation.confidence;
    const verdictPlain =
      verdict === 'INVEST' ? 'Invest'
      : verdict === 'HOLD' ? 'Hold'
      : verdict === 'DE-RISK' ? 'De-risk'
      : verdict === 'EXIT' ? 'Exit'
      : verdict === 'DO-NOT-PROCEED' ? 'Do not proceed'
      : verdict;

    const confidenceLevel = confidence >= 75 ? 'high' : confidence >= 50 ? 'moderate' : 'guarded';
    if (confidenceLevel === 'high') {
      parts.push(`Our position is clear: ${verdictPlain}. We have ${confidence} percent confidence in that call.`);
    } else if (confidenceLevel === 'moderate') {
      parts.push(`We are at ${verdictPlain}, with ${confidence} percent confidence—so the call is there, but we are not at maximum conviction.`);
    } else {
      parts.push(`We are recommending ${verdictPlain} with ${confidence} percent confidence. Given that level, I would treat this as a conditional position until we get more clarity.`);
    }

    // Why we're taking this position: prefer decision narrative, then explanation
    const hasNarrative = decisionInsight?.narrative?.trim().length > 30;
    const explanation = latestRecommendation.explanation?.trim();
    const hasExplanation = explanation && explanation.length > 20;

    if (hasNarrative) {
      parts.push("What drives this: " + decisionInsight!.narrative!.trim());
    } else if (hasExplanation) {
      parts.push("What drives this: " + explanation!);
    } else {
      // Fallback phrasing by verdict
      if (verdict === 'INVEST') {
        parts.push("Underwriting and risk both support moving forward, so we are recommending the board approve this transaction.");
      } else if (verdict === 'HOLD') {
        parts.push("We are not saying no; we are saying wait until key uncertainties are resolved. I am not asking for a go today.");
      } else if (verdict === 'DE-RISK') {
        parts.push("The board should not approve as-is. We need to de-risk or improve terms first; only then can we support an invest.");
      } else if (verdict === 'EXIT' || verdict === 'DO-NOT-PROCEED') {
        parts.push("The analysis does not support proceeding. My recommendation to the board is to exit or not proceed on this basis.");
      }
    }
  } else {
    parts.push("We do not have a recommendation yet. The underwriter needs to be run before I can present a position to the board.");
  }

  // —— Metrics: interpret in context (hurdle, payback) so it feels understood, not read
  if (latestProforma) {
    const irr = latestProforma.irr;
    const irrPct = (irr * 100).toFixed(1);
    const npvCr = (latestProforma.npv / 1e7).toFixed(1);
    const em = latestProforma.equityMultiple.toFixed(2);
    const payback = latestProforma.paybackYear;

    const irrClearsHurdle = irr >= IRR_HURDLE_TYPICAL;
    const paybackReasonable = payback <= PAYBACK_TYPICAL_YEARS;

    parts.push(`On the base case: IRR is ${irrPct} percent, NPV is ${npvCr} crore, equity multiple ${em} times, payback ${payback} years.`);
    if (irrClearsHurdle && paybackReasonable) {
      parts.push("Returns clear our typical hurdle and payback is acceptable—that is the reference case we are standing behind.");
    } else if (!irrClearsHurdle) {
      parts.push("IRR is below our typical hurdle; that is why we are being cautious and why the recommendation is not a straight invest without conditions.");
    } else {
      parts.push("That is the headline return profile we are using versus the rest of the portfolio.");
    }
  }

  // —— Drivers and risks: weave in only if present; one natural sentence each
  if (decisionInsight) {
    const drivers = decisionInsight.topDrivers?.filter(Boolean).slice(0, 3) ?? [];
    const risks = decisionInsight.topRisks?.filter(Boolean).slice(0, 3) ?? [];
    if (drivers.length > 0) {
      parts.push("The main reasons we are comfortable with this call: " + drivers.join(", ") + ".");
    }
    if (risks.length > 0) {
      parts.push("What we are watching: " + risks.join(", ") + ".");
    }
    // Narrative already used above; skip duplicate
  }

  // —— Downside: only if we have MC data
  if (latestMC && (typeof (latestMC as any).probNpvNegative === 'number' || typeof (latestMC as any).probNpvNeg === 'number')) {
    const pNeg = (((latestMC as any).probNpvNegative ?? (latestMC as any).probNpvNeg) * 100).toFixed(0);
    const pNum = Number(pNeg);
    if (pNum > 20) {
      parts.push(`We have quantified downside: ${pNeg} percent probability of negative NPV. That is material; we are comfortable presenting it so the board sees the tail risk.`);
    } else {
      parts.push(`Downside is quantified at ${pNeg} percent probability of negative NPV—within the range we are comfortable with.`);
    }
  }

  if (constructionProgress && (constructionProgress.completionPct ?? 0) > 0) {
    const pct = Math.round((constructionProgress.completionPct ?? 0) * 100);
    parts.push(`On execution: construction is ${pct} percent complete; we are tracking budget and schedule in the Construction tab.`);
  }

  // —— Close: restate position in one line
  parts.push("Bottom line: we are recommending the position I outlined. I am comfortable presenting this to the board. Full detail is in the pack; use Assumptions and What-If if you want to stress-test.");

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
          aria-label={isActive ? 'Pause board briefing' : 'Play CTO board briefing'}
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
          <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide mb-2">Board briefing script — read along</p>
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
