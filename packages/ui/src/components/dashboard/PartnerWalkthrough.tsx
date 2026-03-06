'use client';

/**
 * Partner Walkthrough — AI-Powered CFO Investment Committee briefing.
 *
 * Calls Claude via /api/deals/[dealId]/cfo-briefing to generate a genuine,
 * intelligent CFO IC presentation that synthesizes ALL available data:
 * engine results, 16-agent analyses, market intel, factor scores, Monte Carlo,
 * and the invest wizard verdict. Adapts tone naturally to findings.
 *
 * The old template approach is gone — this is a real AI CFO that speaks with
 * authority, cites specific findings, and connects dots across analyses.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DealDashboardView } from '@v3grand/core';
import { api } from '../../lib/api-client';

const WALKTHROUGH_LABEL = 'CFO investment briefing';
const VOICE_PREFERENCE = 'en-IN';

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
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const dealId = data?.deal?.id;

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setPaused(false);
  }, []);

  const speakNarrative = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92;
    u.pitch = 1;
    u.volume = 1;
    u.lang = VOICE_PREFERENCE;

    // Try to find an Indian English voice
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(v => v.lang.includes('en-IN') || v.lang.includes('en_IN'));
    if (indianVoice) u.voice = indianVoice;

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
  }, []);

  const generateAndPlay = useCallback(async () => {
    if (!dealId || !data) return;

    // If we already have a narrative, just play it
    if (narrative) {
      speakNarrative(narrative);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Gather invest wizard agent results from sessionStorage (if available)
      let agentResults: Array<{ agentName: string; reply: string; error?: string }> = [];
      let investVerdict: string | null = null;
      let investSummary: string | null = null;
      let investKeyMetrics: object | null = null;
      let investWarnings: string[] = [];

      try {
        const storedResult = sessionStorage.getItem('investResult');
        if (storedResult) {
          const parsed = JSON.parse(storedResult);
          if (parsed.dealId === dealId) {
            investVerdict = parsed.verdict;
            investSummary = parsed.summary;
            investKeyMetrics = parsed.keyMetrics;
            investWarnings = parsed.warnings ?? [];
            agentResults = (parsed.agentResults ?? []).map((r: any) => ({
              agentName: r.agentName,
              reply: r.reply,
              error: r.error,
            }));
          }
        }
      } catch {
        // sessionStorage not available or parse error — proceed without agent results
      }

      // Call the AI CFO briefing API
      const result = await api.post<{ narrative: string }>(`/deals/${dealId}/cfo-briefing`, {
        agentResults,
        investVerdict,
        investSummary,
        investKeyMetrics,
        investWarnings,
      });

      setNarrative(result.narrative);
      setLoading(false);
      speakNarrative(result.narrative);
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to generate CFO briefing';
      setError(message);
      console.error('CFO briefing generation failed:', err);
    }
  }, [dealId, data, narrative, speakNarrative]);

  const play = useCallback(() => {
    if (loading) return;

    if (playing && !paused) {
      // Pause
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
      setPaused(true);
      return;
    }
    if (paused) {
      // Resume
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      setPaused(false);
      return;
    }

    // Generate (if needed) and play
    generateAndPlay();
  }, [loading, playing, paused, generateAndPlay]);

  // Clear narrative cache when deal changes
  useEffect(() => {
    setNarrative(null);
    setError(null);
  }, [dealId]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!data) return null;

  const canPlay = !loading;
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
            ${loading
              ? 'border-amber-300 bg-amber-50 text-amber-800 cursor-wait animate-pulse'
              : canPlay
                ? 'border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1'
                : 'border-surface-200 bg-surface-50 text-surface-400 cursor-not-allowed'}
          `}
          aria-label={loading ? 'Generating CFO briefing...' : isActive ? 'Pause investment briefing' : 'Play CFO investment briefing'}
          title={WALKTHROUGH_LABEL}
        >
          {loading ? (
            <>
              <SpinnerIcon className="w-4 h-4 animate-spin" />
              <span>AI CFO is preparing...</span>
            </>
          ) : isActive ? (
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
            onClick={() => {
              if (!narrative && !loading) {
                // Generate without playing if user just wants to read
                generateAndPlay().then(() => {
                  stop(); // Stop speech, just show script
                });
              }
              setShowScript((s) => !s);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
          >
            {showScript ? 'Hide script' : 'Show script'}
          </button>
        )}
        {narrative && !playing && (
          <button
            type="button"
            onClick={() => { setNarrative(null); setError(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2 py-2 text-xs font-medium text-surface-500 hover:bg-surface-50"
            title="Regenerate the CFO briefing with fresh AI analysis"
          >
            <RefreshIcon className="w-3.5 h-3.5" />
            <span>Regenerate</span>
          </button>
        )}
      </div>
      {error && (
        <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {showScript && narrative && (
        <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-surface-500 uppercase tracking-wide">AI CFO Investment Committee briefing</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">AI Generated</span>
          </div>
          <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">{narrative}</p>
        </div>
      )}
      {showScript && !narrative && !loading && (
        <div className="mt-3 rounded-xl border border-surface-200 bg-surface-50/50 p-4">
          <p className="text-sm text-surface-500 italic">Click &quot;CFO investment briefing&quot; to generate the AI-powered narrative.</p>
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export default PartnerWalkthrough;
