'use client';

/**
 * Partner Walkthrough — AI-Powered CFO Investment Committee briefing.
 *
 * Calls Claude via /api/deals/[dealId]/cfo-briefing to generate a genuine,
 * intelligent CFO IC presentation that synthesizes ALL available data.
 *
 * Features:
 * - Natural sentence-by-sentence TTS with pauses between sentences
 * - Language selection: English (Indian), Tamil, Hindi
 * - Adjustable speech rate
 * - Play/Pause/Stop/Regenerate controls
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { DealDashboardView } from '@v3grand/core';
import { api } from '../../lib/api-client';

const WALKTHROUGH_LABEL = 'CFO investment briefing';

type Language = 'en' | 'ta' | 'hi';

const LANGUAGE_CONFIG: Record<Language, { label: string; flag: string; voiceLang: string; promptSuffix: string }> = {
  en: { label: 'English', flag: '🇬🇧', voiceLang: 'en-IN', promptSuffix: '' },
  ta: { label: 'தமிழ்', flag: '🇮🇳', voiceLang: 'ta-IN', promptSuffix: '\n\nIMPORTANT: Generate the ENTIRE briefing in Tamil (தமிழ்). Use formal Tamil appropriate for a boardroom Investment Committee presentation. Financial terms may remain in English where Tamil equivalents are uncommon.' },
  hi: { label: 'हिन्दी', flag: '🇮🇳', voiceLang: 'hi-IN', promptSuffix: '\n\nIMPORTANT: Generate the ENTIRE briefing in Hindi (हिन्दी). Use formal Hindi appropriate for a boardroom Investment Committee presentation. Financial terms may remain in English where Hindi equivalents are uncommon.' },
};

// Sentence splitting for natural pauses
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by space or newline
  const raw = text.split(/(?<=[.!?।])\s+/);
  // Merge very short fragments back into previous sentence
  const merged: string[] = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (merged.length > 0 && trimmed.length < 20) {
      merged[merged.length - 1] += ' ' + trimmed;
    } else {
      merged.push(trimmed);
    }
  }
  return merged;
}

// Section marker parsing for visual navigation
type TabKey = 'overview' | 'underwriting' | 'construction' | 'risks' | 'assumptions' | 'feasibility' | 'market-intel' | 'sensitivity' | 'revaluation' | 'audit';

interface ParsedSentence {
  text: string;
  tabKey?: TabKey;
}

/**
 * Parse narrative into sentences, extracting [SECTION:xxx] markers.
 * Each sentence carries the tab it belongs to (inherited from the last marker).
 */
function parseNarrativeWithSections(text: string): ParsedSentence[] {
  // First, split by section markers to get sections
  const parts = text.split(/\[SECTION:([\w-]+)\]/);
  // parts alternates: text, tabKey, text, tabKey, text ...
  const parsed: ParsedSentence[] = [];
  let currentTab: TabKey | undefined;

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // This is a tab key
      currentTab = parts[i].trim() as TabKey;
      continue;
    }
    // This is text content — split into sentences
    const sentences = splitIntoSentences(parts[i]);
    for (const s of sentences) {
      parsed.push({ text: s, tabKey: currentTab });
    }
  }
  return parsed;
}

/** Strip section markers from text for display/TTS */
function stripSectionMarkers(text: string): string {
  return text.replace(/\[SECTION:[\w-]+\]\s*/g, '').trim();
}

/** Human-readable labels for each tab section shown in progress indicator */
const SECTION_LABELS: Record<TabKey, string> = {
  'overview': 'Overview',
  'underwriting': 'Financials',
  'construction': 'Construction',
  'risks': 'Risk Assessment',
  'assumptions': 'Assumptions',
  'feasibility': 'Feasibility',
  'market-intel': 'Market Intel',
  'sensitivity': 'Stress Test',
  'revaluation': 'Revaluation',
  'audit': 'Audit',
};

export interface PartnerWalkthroughProps {
  data: DealDashboardView | null;
  className?: string;
  compact?: boolean;
  /** Called when the CFO briefing wants to navigate to a dashboard tab */
  onNavigateTab?: (tabKey: string) => void;
}

export function PartnerWalkthrough({ data, className = '', compact = false, onNavigateTab }: PartnerWalkthroughProps) {
  const [playing, setPlaying] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [currentSentence, setCurrentSentence] = useState(-1);
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const sentenceQueueRef = useRef<ParsedSentence[]>([]);
  const sentenceIndexRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isStoppedRef = useRef(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const lastNavigatedTabRef = useRef<string | null>(null);

  const dealId = data?.deal?.id;

  // Close language menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const stop = useCallback(() => {
    isStoppedRef.current = true;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setPaused(false);
    setCurrentSentence(-1);
    setCurrentSection(null);
    sentenceIndexRef.current = 0;
    lastNavigatedTabRef.current = null;
  }, []);

  // Speak sentence by sentence with natural pauses and tab navigation
  const speakSentence = useCallback((sentences: ParsedSentence[], index: number) => {
    if (isStoppedRef.current || index >= sentences.length) {
      setPlaying(false);
      setPaused(false);
      setCurrentSentence(-1);
      setCurrentSection(null);
      lastNavigatedTabRef.current = null;
      return;
    }

    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const parsed = sentences[index];
    setCurrentSentence(index);
    sentenceIndexRef.current = index;

    // Navigate to the tab if this sentence starts a new section
    if (parsed.tabKey && parsed.tabKey !== lastNavigatedTabRef.current) {
      lastNavigatedTabRef.current = parsed.tabKey;
      setCurrentSection(parsed.tabKey);
      onNavigateTab?.(parsed.tabKey);

      // Scroll the tab content into view after a short delay for the tab to render
      setTimeout(() => {
        const tabContent = document.getElementById('deal-tab-content');
        if (tabContent) {
          tabContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }

    const u = new SpeechSynthesisUtterance(parsed.text);
    const langCfg = LANGUAGE_CONFIG[language];

    // Natural CFO voice settings — slower, deeper, more authoritative
    u.rate = 0.88;   // Slightly slower than normal for gravitas
    u.pitch = 0.92;  // Slightly lower pitch for authority
    u.volume = 1;
    u.lang = langCfg.voiceLang;

    // Try to find the best voice for the language
    const voices = window.speechSynthesis.getVoices();
    const langCode = langCfg.voiceLang;
    const bestVoice = voices.find(v =>
      v.lang === langCode || v.lang === langCode.replace('-', '_')
    ) ?? voices.find(v =>
      v.lang.startsWith(langCode.split('-')[0])
    );
    if (bestVoice) u.voice = bestVoice;

    u.onend = () => {
      if (isStoppedRef.current) return;
      // Add a natural pause between sentences (300-600ms depending on punctuation)
      // Longer pause (800ms) when transitioning between sections
      const nextParsed = index + 1 < sentences.length ? sentences[index + 1] : null;
      const isSectionTransition = nextParsed?.tabKey && nextParsed.tabKey !== parsed.tabKey;
      const basePause = parsed.text.endsWith('?') ? 500 : parsed.text.endsWith('!') ? 450 : 350;
      const pauseMs = isSectionTransition ? 800 : basePause;
      setTimeout(() => {
        if (!isStoppedRef.current) {
          speakSentence(sentences, index + 1);
        }
      }, pauseMs);
    };
    u.onerror = () => {
      if (!isStoppedRef.current) {
        speakSentence(sentences, index + 1);
      }
    };

    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  }, [language, onNavigateTab]);

  const speakNarrative = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    isStoppedRef.current = false;
    lastNavigatedTabRef.current = null;

    const parsed = parseNarrativeWithSections(text);
    sentenceQueueRef.current = parsed;
    sentenceIndexRef.current = 0;

    setPlaying(true);
    setPaused(false);
    speakSentence(parsed, 0);
  }, [speakSentence]);

  const generateAndPlay = useCallback(async (forceLang?: Language) => {
    if (!dealId || !data) return;

    const lang = forceLang ?? language;

    // If we have a narrative for the current language, just play it
    if (narrative && !forceLang) {
      speakNarrative(narrative);
      return;
    }

    setLoading(true);
    setError(null);

    try {
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
        // sessionStorage not available
      }

      const langCfg = LANGUAGE_CONFIG[lang];
      const result = await api.post<{ narrative: string }>(`/deals/${dealId}/cfo-briefing`, {
        agentResults,
        investVerdict,
        investSummary,
        investKeyMetrics,
        investWarnings,
        languageSuffix: langCfg.promptSuffix,
      });

      setNarrative(result.narrative);
      setLoading(false);
      speakNarrative(result.narrative);
    } catch (err) {
      setLoading(false);
      const message = err instanceof Error ? err.message : 'Failed to generate CFO briefing';
      setError(message);
    }
  }, [dealId, data, narrative, language, speakNarrative]);

  const play = useCallback(() => {
    if (loading) return;

    if (playing && !paused) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
      setPaused(true);
      return;
    }
    if (paused) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      setPaused(false);
      return;
    }

    generateAndPlay();
  }, [loading, playing, paused, generateAndPlay]);

  const switchLanguage = useCallback((lang: Language) => {
    setLanguage(lang);
    setShowLangMenu(false);
    stop();
    setNarrative(null); // Clear cached narrative so it regenerates in new language
  }, [stop]);

  // Clear narrative cache when deal changes
  useEffect(() => {
    setNarrative(null);
    setError(null);
  }, [dealId]);

  useEffect(() => {
    return () => {
      isStoppedRef.current = true;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Pre-load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  if (!data) return null;

  const canPlay = !loading;
  const isActive = playing && !paused;
  const langCfg = LANGUAGE_CONFIG[language];

  return (
    <div className={`${className}`}>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Play/Pause button */}
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

        {/* Stop button */}
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

        {/* Language Selector */}
        <div className="relative" ref={langMenuRef}>
          <button
            type="button"
            onClick={() => setShowLangMenu((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
            title="Select language"
          >
            <span>{langCfg.flag}</span>
            <span className="text-xs">{langCfg.label}</span>
            <svg className="w-3 h-3 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showLangMenu && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-surface-200 rounded-lg shadow-lg z-50 overflow-hidden">
              {(Object.entries(LANGUAGE_CONFIG) as [Language, typeof LANGUAGE_CONFIG['en']][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => switchLanguage(key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-50 transition-colors ${
                    language === key ? 'bg-brand-50 text-brand-700 font-medium' : 'text-surface-700'
                  }`}
                >
                  <span>{cfg.flag}</span>
                  <span>{cfg.label}</span>
                  {language === key && <span className="ml-auto text-brand-500 text-xs">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Show Script */}
        {!compact && (
          <button
            type="button"
            onClick={() => {
              if (!narrative && !loading) {
                generateAndPlay().then(() => {
                  stop();
                });
              }
              setShowScript((s) => !s);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-white px-2.5 py-2 text-sm font-medium text-surface-600 hover:bg-surface-50 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1"
          >
            {showScript ? 'Hide script' : 'Show script'}
          </button>
        )}

        {/* Regenerate */}
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

      {/* Progress indicator with section label */}
      {playing && sentenceQueueRef.current.length > 0 && (
        <div className="mt-2 flex items-center gap-2">
          {currentSection && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 font-semibold uppercase tracking-wider whitespace-nowrap animate-pulse">
              {SECTION_LABELS[currentSection as TabKey] ?? currentSection}
            </span>
          )}
          <div className="flex-1 h-1.5 bg-surface-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentSentence + 1) / sentenceQueueRef.current.length) * 100}%` }}
            />
          </div>
          <span className="text-2xs text-surface-400 font-mono">
            {currentSentence + 1}/{sentenceQueueRef.current.length}
          </span>
        </div>
      )}

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
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-600 font-medium">{langCfg.label}</span>
          </div>
          <p className="text-sm text-surface-800 leading-relaxed whitespace-pre-wrap">{stripSectionMarkers(narrative)}</p>
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
